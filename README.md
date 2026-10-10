# Visual Intelligence 2.0 · Dum Sarat — event site with team registration

```
backend/   FastAPI + SQLAlchemy API (also serves the website)
frontend/  index.html, style.css, app.js, assets/ (logos cut from the poster)
```

## Run locally
```bash
cd backend
pip install -r requirements.txt
ADMIN_KEY=secret python -m uvicorn main:app --reload
# open http://localhost:8000
```
SQLite is created automatically at `backend/data/registrations.db`.

## How registration works
1. **Register team** → choose **Create a team** (you become the leader) or **Join a team**.
2. Leader enters name, register number, email, department and team name → team is created with a 6-character code.
3. The lobby page shows the code, invite link, QR code, WhatsApp share and a live member list (updates every 6 s).
4. Friends open the link (or enter the code), add their details and appear in the lobby.
5. A team is complete at `TEAM_MIN` (default 4) members and holds up to `TEAM_MAX` (default 5). The leader can remove members.

Rules enforced by the server: unique team names, one team per register number and per email, full teams reject new members.
Each team gets an auto-generated logo (shape, colours and initials come from the team name).

## Live leaderboard (`#/leaderboard`)
- Podium for the top 3, stat cards (teams, current stage, stage timer, leading team, submissions), overall + per-stage tabs, search, rank movement arrows and a live activity feed.
- Refreshes every 4 seconds with animated re-ranking. **Projector mode** goes fullscreen for the big screen.
- Teams with equal totals share a rank.

## Organiser panel (`#/admin`)
Open `https://your-site/#/admin` and enter your `ADMIN_KEY` (the page is not linked anywhere public).
- Set the current stage (Not started, stages 1 to 4, Finished) and start a countdown timer.
- Enter or edit each team's points per stage, press Save, and the leaderboard updates within seconds.
- Export all registrations as CSV. Points are limited to 0–1000 per stage (`MAX_POINTS`).

## Organiser tools (API)
```bash
curl -H "X-Admin-Key: secret" http://localhost:8000/api/admin/export.csv -o registrations.csv
curl -H "X-Admin-Key: secret" http://localhost:8000/api/admin/teams
```
Score API: `PUT /api/admin/scores` `{team_code, stage, points}`, `DELETE /api/admin/scores/{team_code}/{stage}`, `PUT /api/admin/event` `{current_stage, timer_minutes}`. Admin endpoints stay disabled until `ADMIN_KEY` is set. Interactive API docs: `/api/docs`.

## Deploy (free tier)
**Database:** Render's free disk is wiped on restarts, so use Supabase Postgres. Copy the connection string into `DATABASE_URL`.

**Render (one service serves both site and API):**
- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"`
- Env: `DATABASE_URL`, `ADMIN_KEY`, `PUBLIC_URL`

**Frontend on Vercel instead?** Deploy `frontend/`, set `window.API_BASE` in `frontend/config.js` to your Render URL, and add the Vercel URL to `CORS_ORIGINS` on Render.

## Editing content
- Event details, stage names and copy: `home()` in `frontend/app.js`
- Event date for the countdown: `EVENT_TS` at the top of `frontend/app.js`
- Colours and fonts: `:root` in `frontend/style.css`
- Departments list: `DEPARTMENTS` in `backend/main.py`
