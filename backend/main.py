"""
Visual Intelligence 2.0 – registration backend (FastAPI + SQLAlchemy).

Run locally:   uvicorn main:app --reload        (from the backend/ folder)
Serves the frontend/ folder at "/" and the JSON API under "/api".

Environment variables (all optional):
  DATABASE_URL   default sqlite:///./data/registrations.db
                 for Supabase/Postgres: postgresql+psycopg2://user:pass@host:5432/postgres
  ADMIN_KEY      secret for /api/admin/* (admin endpoints are disabled when unset)
  TEAM_MIN       members needed for a complete team   (default 4)
  TEAM_MAX       maximum members per team             (default 5)
  CORS_ORIGINS   comma-separated origins, only needed if the frontend is hosted elsewhere
  PUBLIC_URL     public site URL used inside QR codes (default: the request's own URL)
"""
import csv
import io
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import segno
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, create_engine, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, selectinload, sessionmaker

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

TEAM_MIN = int(os.getenv("TEAM_MIN", "4"))
TEAM_MAX = int(os.getenv("TEAM_MAX", "5"))
ADMIN_KEY = os.getenv("ADMIN_KEY", "")
PUBLIC_URL = os.getenv("PUBLIC_URL", "").rstrip("/")
MAX_POINTS = int(os.getenv("MAX_POINTS", "1000"))
STAGE_NAMES = ["Speed Typing", "Blind Typing", "Prompt Copycat", "Prompt Charades"]

DEPARTMENTS = [
    "CST", "CSE", "AI & Data Science", "AI & ML", "Information Technology",
    "Cyber Security", "ECE", "EEE", "Mechanical", "Civil", "Other",
]

# ------------------------------------------------------------------ database
db_url = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'data' / 'registrations.db'}")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
if db_url.startswith("sqlite:///"):
    Path(db_url.replace("sqlite:///", "", 1)).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    db_url,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if db_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def now():
    return datetime.now(timezone.utc)


class Team(Base):
    __tablename__ = "teams"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(60))
    name_key: Mapped[str] = mapped_column(String(60), unique=True)
    leader_token: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    members: Mapped[list["Member"]] = relationship(
        back_populates="team", order_by="Member.id", cascade="all, delete-orphan"
    )
    scores: Mapped[list["Score"]] = relationship(back_populates="team", cascade="all, delete-orphan")


class Member(Base):
    __tablename__ = "members"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    reg_no: Mapped[str] = mapped_column(String(24), unique=True)
    email: Mapped[str] = mapped_column(String(120), unique=True)
    department: Mapped[str] = mapped_column(String(60))
    role: Mapped[str] = mapped_column(String(10), default="member")  # leader | member
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    team: Mapped[Team] = relationship(back_populates="members")


class Score(Base):
    """One row per team per stage (1-4). Re-entering a score replaces it."""
    __tablename__ = "scores"
    __table_args__ = (UniqueConstraint("team_id", "stage", name="uq_team_stage"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)
    stage: Mapped[int] = mapped_column(Integer)
    points: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    team: Mapped[Team] = relationship(back_populates="scores")


class Activity(Base):
    __tablename__ = "activity"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    message: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(12), default="info")  # score | lead | stage | info
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RankSnap(Base):
    """Ranks just before the latest score change, used to show up/down movement."""
    __tablename__ = "rank_snap"
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), primary_key=True)
    rank: Mapped[int] = mapped_column(Integer)


class EventState(Base):
    __tablename__ = "event_state"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    current_stage: Mapped[int] = mapped_column(Integer, default=0)  # 0 not started, 1-4, 5 finished
    timer_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


Base.metadata.create_all(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ------------------------------------------------------------------ schemas
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
REG_RE = re.compile(r"^[A-Za-z0-9]{6,20}$")
TEAM_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _.&'+!#\-]{1,38}[A-Za-z0-9.!+#]$")


class MemberIn(BaseModel):
    name: str
    reg_no: str
    email: str
    department: str

    @field_validator("name")
    @classmethod
    def v_name(cls, v):
        v = re.sub(r"\s+", " ", v).strip()
        if not 2 <= len(v) <= 60:
            raise ValueError("Enter your full name (2–60 characters).")
        return v

    @field_validator("reg_no")
    @classmethod
    def v_reg(cls, v):
        v = v.strip().upper()
        if not REG_RE.match(v):
            raise ValueError("Register number should be 6–20 letters or digits, e.g. URK24CS1001.")
        return v

    @field_validator("email")
    @classmethod
    def v_email(cls, v):
        v = v.strip().lower()
        if not EMAIL_RE.match(v) or len(v) > 120:
            raise ValueError("Enter a valid email address.")
        return v

    @field_validator("department")
    @classmethod
    def v_dep(cls, v):
        v = re.sub(r"\s+", " ", v).strip()
        if not 2 <= len(v) <= 60:
            raise ValueError("Choose your department.")
        return v


class TeamIn(MemberIn):
    team_name: str

    @field_validator("team_name")
    @classmethod
    def v_team(cls, v):
        v = re.sub(r"\s+", " ", v).strip()
        if not TEAM_RE.match(v):
            raise ValueError("Team name must be 3–40 characters (letters, numbers, spaces and - _ . & ' + ! #).")
        return v


# ------------------------------------------------------------------ helpers
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_code(db: Session) -> str:
    while True:
        code = "".join(secrets.choice(CODE_CHARS) for _ in range(6))
        if not db.scalar(select(Team.id).where(Team.code == code)):
            return code


def team_view(t: Team, manage: bool = False) -> dict:
    n = len(t.members)
    return {
        "code": t.code,
        "name": t.name,
        "size": n,
        "min": TEAM_MIN,
        "max": TEAM_MAX,
        "complete": n >= TEAM_MIN,
        "full": n >= TEAM_MAX,
        "can_manage": manage,
        "members": [
            {"id": m.id, "name": m.name, "department": m.department, "role": m.role}
            for m in t.members
        ],
    }


def find_team(db: Session, code: str) -> Team:
    t = db.scalar(select(Team).where(Team.code == code.strip().upper()))
    if not t:
        raise HTTPException(404, "No team found with that code. Check the code and try again.")
    return t


def conflicts(db: Session, reg_no: str, email: str):
    if db.scalar(select(Member.id).where(Member.reg_no == reg_no)):
        raise HTTPException(409, "This register number is already part of a team.")
    if db.scalar(select(Member.id).where(Member.email == email)):
        raise HTTPException(409, "This email is already registered with a team.")


def require_admin(x_admin_key: Optional[str] = Header(default=None)):
    if not ADMIN_KEY:
        raise HTTPException(403, "Admin access is disabled. Set the ADMIN_KEY environment variable.")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, ADMIN_KEY):
        raise HTTPException(401, "Invalid admin key.")


# ------------------------------------------------------------------ app
app = FastAPI(title="Visual Intelligence 2.0 API", docs_url="/api/docs", openapi_url="/api/openapi.json")

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
if origins:
    app.add_middleware(
        CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"],
    )


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/config")
def config():
    return {"team_min": TEAM_MIN, "team_max": TEAM_MAX, "departments": DEPARTMENTS, "stages": STAGE_NAMES}


@app.get("/api/stats")
def stats(db: Session = Depends(get_db)):
    teams = db.scalar(select(func.count(Team.id))) or 0
    people = db.scalar(select(func.count(Member.id))) or 0
    sizes = db.execute(select(func.count(Member.id)).group_by(Member.team_id)).scalars().all()
    return {"teams": teams, "participants": people, "complete_teams": sum(1 for s in sizes if s >= TEAM_MIN)}


@app.post("/api/teams", status_code=201)
def create_team(body: TeamIn, db: Session = Depends(get_db)):
    """The person who creates a team becomes its leader."""
    key = body.team_name.lower()
    if db.scalar(select(Team.id).where(Team.name_key == key)):
        raise HTTPException(409, "That team name is taken. Try another one.")
    conflicts(db, body.reg_no, body.email)
    token = secrets.token_urlsafe(24)
    team = Team(code=new_code(db), name=body.team_name, name_key=key, leader_token=token)
    team.members.append(Member(
        name=body.name, reg_no=body.reg_no, email=body.email,
        department=body.department, role="leader",
    ))
    db.add(team)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Someone just registered with these details. Please check and retry.")
    return {"token": token, "team": team_view(team, manage=True)}


@app.get("/api/teams/{code}")
def get_team(code: str, db: Session = Depends(get_db), x_leader_token: Optional[str] = Header(default=None)):
    t = find_team(db, code)
    manage = bool(x_leader_token) and secrets.compare_digest(x_leader_token, t.leader_token)
    return team_view(t, manage)


@app.post("/api/teams/{code}/join", status_code=201)
def join_team(code: str, body: MemberIn, db: Session = Depends(get_db)):
    t = find_team(db, code)
    if len(t.members) >= TEAM_MAX:
        raise HTTPException(409, f"This team already has {TEAM_MAX} members and is full.")
    conflicts(db, body.reg_no, body.email)
    t.members.append(Member(
        name=body.name, reg_no=body.reg_no, email=body.email,
        department=body.department, role="member",
    ))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "These details are already registered.")
    db.refresh(t)
    mine = t.members[-1]
    return {"member_id": mine.id, "team": team_view(t)}


@app.delete("/api/teams/{code}/members/{member_id}")
def remove_member(code: str, member_id: int, db: Session = Depends(get_db),
                  x_leader_token: Optional[str] = Header(default=None)):
    t = find_team(db, code)
    if not x_leader_token or not secrets.compare_digest(x_leader_token, t.leader_token):
        raise HTTPException(403, "Only the team leader can remove members.")
    m = next((m for m in t.members if m.id == member_id), None)
    if not m:
        raise HTTPException(404, "Member not found.")
    if m.role == "leader":
        raise HTTPException(400, "The team leader cannot be removed.")
    db.delete(m)
    db.commit()
    db.refresh(t)
    return team_view(t, manage=True)


@app.get("/api/teams/{code}/qr.svg")
def team_qr(code: str, request: Request, db: Session = Depends(get_db)):
    t = find_team(db, code)
    base = PUBLIC_URL or str(request.base_url).rstrip("/")
    qr = segno.make(f"{base}/#/join/{t.code}", error="m")
    buf = io.BytesIO()
    qr.save(buf, kind="svg", scale=8, border=1, dark="#8f2a0d", light="#fbf6ea", xmldecl=False, svgns=True)
    return Response(buf.getvalue(), media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=3600"})



# ------------------------------------------------------------------ leaderboard
def aware(dt):
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def standings(db: Session):
    """All teams ranked by total score (ties share a rank)."""
    teams = db.scalars(
        select(Team).options(selectinload(Team.scores), selectinload(Team.members)).order_by(Team.id)
    ).all()
    rows = []
    for t in teams:
        by = {sc.stage: sc.points for sc in t.scores}
        rows.append({"team": t, "stages": [by.get(i) for i in range(1, 5)], "total": sum(by.values()), "scored": bool(by)})
    rows.sort(key=lambda r: (-r["total"], r["team"].name.lower()))
    prev, rank = None, 0
    for i, r in enumerate(rows, 1):
        if r["total"] != prev:
            rank, prev = i, r["total"]
        r["rank"] = rank
    return rows


def snapshot_ranks(db: Session, rows):
    snap = {s.team_id: s for s in db.scalars(select(RankSnap))}
    for r in rows:
        tid = r["team"].id
        if tid in snap:
            snap[tid].rank = r["rank"]
        else:
            db.add(RankSnap(team_id=tid, rank=r["rank"]))


def leader_id(rows):
    return rows[0]["team"].id if rows and rows[0]["total"] > 0 else None


@app.get("/api/leaderboard")
def leaderboard(db: Session = Depends(get_db)):
    rows = standings(db)
    snap = {s.team_id: s.rank for s in db.scalars(select(RankSnap))}
    ev = db.get(EventState, 1)
    stage = ev.current_stage if ev else 0
    remaining = None
    if ev and ev.timer_ends_at:
        remaining = max(0, int((aware(ev.timer_ends_at) - now()).total_seconds()))
    lid = leader_id(rows)
    teams = [{
        "rank": r["rank"], "code": r["team"].code, "name": r["team"].name, "total": r["total"],
        "stages": r["stages"], "scored": r["scored"], "size": len(r["team"].members),
        "complete": len(r["team"].members) >= TEAM_MIN,
        "movement": (snap.get(r["team"].id, r["rank"]) - r["rank"]) if r["scored"] else 0,
        "members": [m.name for m in r["team"].members],
    } for r in rows]
    acts = db.scalars(select(Activity).order_by(Activity.id.desc()).limit(14)).all()
    body = {
        "server_time": now().isoformat(),
        "event": {"current_stage": stage, "stage_name": STAGE_NAMES[stage - 1] if 1 <= stage <= 4 else None,
                  "timer_seconds": remaining, "stages": STAGE_NAMES},
        "stats": {"teams": len(rows), "scored_teams": sum(1 for r in rows if r["scored"]),
                  "submissions": db.scalar(select(func.count(Score.id))) or 0,
                  "leader": next((r["team"].name for r in rows if r["team"].id == lid), None)},
        "teams": teams,
        "activity": [{"id": a.id, "message": a.message, "kind": a.kind, "at": aware(a.created_at).isoformat()} for a in acts],
    }
    return Response(__import__("json").dumps(body), media_type="application/json", headers={"Cache-Control": "no-store"})


class ScoreIn(BaseModel):
    team_code: str
    stage: int
    points: int

    @field_validator("stage")
    @classmethod
    def v_stage(cls, v):
        if not 1 <= v <= 4:
            raise ValueError("Stage must be 1 to 4.")
        return v

    @field_validator("points")
    @classmethod
    def v_points(cls, v):
        if not 0 <= v <= MAX_POINTS:
            raise ValueError(f"Points must be between 0 and {MAX_POINTS}.")
        return v


class EventIn(BaseModel):
    current_stage: int
    timer_minutes: Optional[int] = None

    @field_validator("current_stage")
    @classmethod
    def v_cs(cls, v):
        if not 0 <= v <= 5:
            raise ValueError("Stage must be 0 (not started), 1 to 4, or 5 (finished).")
        return v

    @field_validator("timer_minutes")
    @classmethod
    def v_tm(cls, v):
        if v is not None and not 1 <= v <= 240:
            raise ValueError("Timer must be 1 to 240 minutes.")
        return v


@app.put("/api/admin/scores", dependencies=[Depends(require_admin)])
def admin_set_score(body: ScoreIn, db: Session = Depends(get_db)):
    t = find_team(db, body.team_code)
    before = standings(db)
    snapshot_ranks(db, before)
    lead_before = leader_id(before)
    sc = next((x for x in t.scores if x.stage == body.stage), None)
    if sc:
        sc.points, sc.updated_at = body.points, now()
    else:
        t.scores.append(Score(stage=body.stage, points=body.points))
    db.add(Activity(message=f"{t.name} scored {body.points} in {STAGE_NAMES[body.stage - 1]}", kind="score"))
    db.flush()
    after = standings(db)
    if leader_id(after) == t.id and lead_before != t.id:
        db.add(Activity(message=f"{t.name} takes the lead", kind="lead"))
    db.commit()
    me = next(r for r in after if r["team"].id == t.id)
    return {"ok": True, "total": me["total"], "rank": me["rank"]}


@app.delete("/api/admin/scores/{team_code}/{stage}", dependencies=[Depends(require_admin)])
def admin_delete_score(team_code: str, stage: int, db: Session = Depends(get_db)):
    t = find_team(db, team_code)
    snapshot_ranks(db, standings(db))
    sc = next((x for x in t.scores if x.stage == stage), None)
    if not sc:
        raise HTTPException(404, "No score entered for that stage.")
    t.scores.remove(sc)
    db.commit()
    return {"ok": True}


@app.put("/api/admin/event", dependencies=[Depends(require_admin)])
def admin_event(body: EventIn, db: Session = Depends(get_db)):
    ev = db.get(EventState, 1)
    if not ev:
        ev = EventState(id=1, current_stage=0)
        db.add(ev)
    changed = ev.current_stage != body.current_stage
    ev.current_stage = body.current_stage
    ev.timer_ends_at = now() + timedelta(minutes=body.timer_minutes) if body.timer_minutes and 1 <= body.current_stage <= 4 else None
    if changed:
        if 1 <= body.current_stage <= 4:
            db.add(Activity(message=f"Stage {body.current_stage} · {STAGE_NAMES[body.current_stage - 1]} has begun", kind="stage"))
        elif body.current_stage == 5:
            db.add(Activity(message="All stages complete. Final results are in.", kind="stage"))
    db.commit()
    return {"ok": True, "current_stage": ev.current_stage}


# ---- organiser endpoints (send header  X-Admin-Key: <ADMIN_KEY>)
@app.get("/api/admin/teams", dependencies=[Depends(require_admin)])
def admin_teams(db: Session = Depends(get_db)):
    teams = db.scalars(select(Team).options(selectinload(Team.scores), selectinload(Team.members)).order_by(Team.id)).all()
    return [{
        "code": t.code, "team": t.name, "size": len(t.members), "complete": len(t.members) >= TEAM_MIN,
        "created_at": t.created_at.isoformat(),
        "scores": {sc.stage: sc.points for sc in t.scores},
        "members": [{"role": m.role, "name": m.name, "reg_no": m.reg_no, "email": m.email,
                     "department": m.department} for m in t.members],
    } for t in teams]


@app.get("/api/admin/export.csv", dependencies=[Depends(require_admin)])
def admin_csv(db: Session = Depends(get_db)):
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["team_code", "team_name", "role", "name", "register_number", "email", "department", "registered_at"])
    for t in db.scalars(select(Team).order_by(Team.id)).all():
        for m in t.members:
            w.writerow([t.code, t.name, m.role, m.name, m.reg_no, m.email, m.department, m.joined_at.isoformat()])
    return Response(out.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=registrations.csv"})


# ---- frontend (mounted last so /api/* wins)
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
