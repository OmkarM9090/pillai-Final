# Smart Resort 360

> AI-powered resort operations, guest experience, and revenue intelligence platform — one connected operating system:
> PREDICT → UNDERSTAND → SIMULATE → RECOMMEND → MANAGER APPROVAL → EXECUTE → NOTIFY → STAFF ACTION → RESULT → FEEDBACK.

## 🎬 3-minute judge demo (all flows are live, DB-backed and role-gated)

| # | Actor | Action | What happens (all real) |
|---|-------|--------|--------------------------|
| 1 | **GM** | Login → **Command Center** | Live KPIs, staff workload, guest requests, decisions, incidents from MongoDB |
| 2 | **GM** | **Time Machine** → drag occupancy to **95%** | Trained ML occupancy forecast + digital-twin re-simulation; **Baseline → Scenario → Δ** table (staff gap, F&B, inventory, resilience, GOPPAR) is *computed*, never hardcoded |
| 3 | **GM** | **Create Action Plan** → approve in **Review & Kanban** | Plan becomes operational ticket, staff assigned, audit logged |
| 4 | **Worker** (`housekeeper@smartresort.demo`) | Login → **My Tasks** | Sees real dispatch → Accept → Start → log **on-site observation** ("AC leaking") → Complete (note required) |
| 5 | **GM** | Command Center **Guests / Feedback / Observations** | Observation routed to maintenance (ticket created, dept notified); completion + feedback visible |
| 6 | **Guest** (Room **105** + PIN **BK-RESORT-105**, or `guest@smartresort.demo`) | Concierge: *"The AC in my room is leaking"* → *"What time is breakfast?"* | Request → NLP → maintenance task (staff notified); question answered **without** creating a task; feedback unlocks only after completion |
| 7 | **GM** | **Guest Requests** | Room-change request sits in **PENDING_APPROVAL** → **Approve / Decline / Modify** executes against staff, guest notifications and audit |
| 8 | **GM** | **Live Intel / Weather Twin / Incidents / Proactive** | Weather+social signals with cached fallbacks, geospatial zone map, emergency incident state machine (DETECTED→…→CLOSED), proactive staffing/inventory/maintenance recommendations |

## 🚀 Hackathon Quick Start (3 terminals, no MongoDB install needed)

```bash
# Terminal 1 — local Mongo-compatible DB (SQLite-backed, zero setup)
cd server && npm install && npm run db:local

# Terminal 2 — API server (seeds demo data first)
cd server
cp .env.example .env   # then set MONGODB_URI=mongodb://127.0.0.1:27017/smart-resort-360
npm run seed:all       # seeds rooms, staff, demo users + admin
npm run dev            # API on http://localhost:5000

# Terminal 3 — frontend
cd client && npm install && npm run dev   # http://localhost:5173

# Terminal 4 (optional but recommended) — trained-model AI core
cd ml-server && pip install -r requirements.txt   # pins scikit-learn 1.6.1 (required: models were serialized with it)
uvicorn main:app --host 0.0.0.0 --port 8000        # falls back deterministically if not running
```

### Demo logins (password: `demo123`)

| Persona | Email | Lands on |
|---------|-------|----------|
| Manager | `manager@smartresort.demo` | Command Center Dashboard |
| Supervisor | `housekeeping.supervisor@smartresort.demo` | Dashboard |
| Worker | `housekeeper@smartresort.demo` | Worker Portal |
| Guest | `guest@smartresort.demo` | Guest Concierge Portal |
| Guest (check-in) | Room **105** + PIN **BK-RESORT-105** | `/login` → *Guest (check-in)* tab |
| Super Admin | `admin@resort360.com` | Dashboard (password: `Admin@123456`) |

### Key workflow APIs (all authenticated, role-authorized, validated, audited)

```
POST /api/v1/guest-request | /guest/concierge          guest input → NLP → route/assign/escalate
PATCH /api/v1/guest-requests/:id/approve|decline|modify  real manager decisions (guest/staff notified)
GET    /api/v1/manager/guest-requests|feedback|observations
PATCH  /api/v1/worker-tasks/:id/accept|reject|start|complete|block   reject & complete require reasons/notes
POST   /api/v1/worker-tasks/:id/observation            on-site observation → routed dept ticket
PATCH  /api/v1/guest-requests/:id/feedback             gated: only after COMPLETED, once
POST   /api/v1/incidents · PATCH /api/v1/incidents/:id emergency state machine DETECTED→…→CLOSED
POST   /api/v1/simulate · /generate-plan · /approve-plan   Time Machine → action plan → execution
POST   /api/v1/proactive/scan                          prediction → preventive action (deduped)
GET    /api/v1/notifications                           role-targeted, persisted, source-linked
```

### 🌩️ Live Intelligence suite (weather · geospatial · social · twin · AI)

Five judge-facing capabilities, all wired end-to-end into the existing platform:

| # | Feature | Where to see it | What is real |
|---|---------|-----------------|--------------|
| 1 | **Live weather integration** | `Live Intel` page → *Feature 1* hero + "Weather → AI model inputs" | Open-Meteo current + 24 h + 5-day feed, scored into an operational severity index whose features (`weather_score`, `demand_shock`, `staff_availability`, `outdoor_viability`) are fed to the trained ML demand model and the Python simulator — the page shows the weather-adjusted occupancy next to a clear-sky counterfactual |
| 2 | **Geospatial map visualisation** | `Live Intel` → impact map · `Weather Twin` → propagation map | Leaflet map of the 8 real resort zones, live zone risk colouring, storm bearing line, animated propagation rings, geolocated social posts and neighbourhood context points |
| 3 | **Real-world social signals** | `Live Intel` → social feed, sentiment, themes, emerging incidents | GDELT news index + Mastodon public timeline (keyless, CORS-relayed through the operator browser); sentiment, theme extraction, traveller-impact scoring and spike detection |
| 4 | **Digital-twin what-if** | `Weather Twin` page (and the copilot: *"what if 45 mm/h rain for 6 hours"*) | 5 live sliders (intensity, duration, wind, temperature, storm distance) re-run the real twin snapshot: resilience, safe occupancy ceiling, department pressure, staffing gap, rooms to reallocate, F&B covers, GOPPAR and revenue at risk all move, with a 6-step propagation timeline, a costed mitigation plan and **Apply to live system** (creates real action cards / tickets) |
| 5 | **AI LLM + resort chatbot** | Floating copilot on every page (staff = *Operations Copilot*, guest = *Aria*) | Grounded on live weather, social and twin context; tool-calling (runs what-if scenarios, dispatches real guest requests end-to-end). Uses a cloud LLM when a key is present, otherwise the deterministic on-board reasoning engine — never hallucinated numbers |

**Optional — switch the chatbot to a cloud LLM.** Everything works without any API key (the on-board reasoner answers). To use a hosted model instead, add *one* of these to `server/.env` and restart the API — no code change:

```bash
GEMINI_API_KEY=...      # gemini-2.0-flash (recommended, free tier)
OPENAI_API_KEY=...      # gpt-4o-mini
GROQ_API_KEY=...        # llama-3.3-70b
OPENROUTER_API_KEY=...
OLLAMA_URL=http://localhost:11434   # fully local
```

`GET /api/v1/ai/status` reports the active provider; the copilot header shows it live.

**Note on network egress.** If the API host cannot reach the public internet, the weather/social services fall back to a calibrated monsoon-climatology model and clearly label themselves `MODEL FALLBACK` / `SIMULATED`. The operator's browser then relays genuinely live Open-Meteo, GDELT and Mastodon data to the server automatically (`POST /intel/weather/ingest`, `POST /intel/social/ingest`) and the badges flip to `LIVE` / `RELAY`.

### 3-minute demo script

1. **Guest portal** (`guest@smartresort.demo`) → type *"The AC in my room is broken"* → AI concierge classifies intent, sets priority/SLA and auto-dispatches staff.
2. Repeat the AC complaint from 2 more rooms → **Manager → Incidents** → *Cluster Complaints* → systemic issue detected, master ticket + action card created.
3. **Worker portal** (`housekeeper@smartresort.demo`) → accept → start → complete the task; guest can then rate it (low rating triggers automatic service recovery).
4. **Manager → Time Machine** → push occupancy to 95% + storm severity → run simulation → *Create Action Plan* → approve it in **Council & Approval**.
5. **Dashboard** shows live occupancy, department pressure, critical incidents and the audit trail the whole time (auto-refreshes).

### 5-minute "live intelligence" demo script

1. **Live Intel** (`manager@smartresort.demo`) → point at the source chips (`LIVE`/`RELAY`), the severity decomposition and the **Weather → AI model inputs** card: the same live feed produces a weather-adjusted occupancy forecast vs the clear-sky counterfactual.
2. Scroll to the **map** → toggle layers, click a zone: risk is computed from rainfall, drainage capacity, elevation and storm distance. Click a social pin to see the actual public post behind it.
3. **Social panel** → sentiment trend, emerging *"flooding spiking near the resort"* card — traveller reactions before they become complaints.
4. **Weather Twin** → drag *Rain intensity* to 45 mm/h and *Duration* to 6 h (or hit the **Monsoon cloudburst** preset): resilience drops 92 → 42, safe occupancy ceiling 100 % → 80 %, housekeeping goes over 100 %, 16 rooms need reallocation, ₹24k revenue at risk — then watch the propagation timeline and press **Apply to live system**.
5. **Copilot** (bottom-right, any page) → *"what if 50 mm/h rain for 6 hours with 70 km/h wind?"* → the chatbot runs the twin itself and returns the costed plan. Log in as the **guest** and ask *"it's raining, can I get towels and an umbrella?"* → a real request is created, dispatched and visible in the worker portal.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 18.x |
| npm | >= 9.x |
| MongoDB Atlas | Cluster (free tier works) |

---

## Installation

```bash
cd server && npm install
cd ../client && npm install
```

---

## Environment Variables

### Server `server/.env`

```env
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smart-resort-360?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-change-this
CLIENT_URL=http://localhost:5173
NODE_ENV=development
SEED_ADMIN_NAME=Super Admin
SEED_ADMIN_EMAIL=admin@resort360.com
SEED_ADMIN_PASSWORD=Admin@123456
```

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Signing secret (min 32 chars) |
| `PORT` | No | Server port (default 5000) |
| `CLIENT_URL` | No | Frontend URL for CORS |

---

## MongoDB Connection

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a free cluster
3. Create a DB user with read/write access
4. Whitelist your IP (or `0.0.0.0/0` for dev)
5. Copy the connection string into `MONGODB_URI`

The app retries the connection 3 times before failing gracefully.

---

## Running the Backend

```bash
cd server
npm run dev        # Development with auto-reload
npm run build      # TypeScript compile
npm start          # Production
```

Server starts at `http://localhost:5000`

---

## Running the Frontend

```bash
cd client
npm run dev
```

Frontend starts at `http://localhost:5173` and proxies `/api` to the backend.

---

## Seed Command

```bash
cd server
npm run seed
```

Creates a `SUPER_ADMIN` user using `.env` credentials.
Default: `admin@resort360.com` / `Admin@123456`

---

## API Health Check

```
GET http://localhost:5000/api/health
```

Returns server status, database status, uptime, and environment.

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | Public | Register user |
| POST | /api/auth/login | Public | Login / get JWT |
| GET | /api/auth/me | Bearer | Current user |
| POST | /api/auth/logout | Bearer | Logout |
| GET | /api/health | Public | Health check |

---

## Role System

All employees use the same app. UI and modules adapt per role.

Roles: `SUPER_ADMIN`, `GENERAL_MANAGER`, `DEPARTMENT_HEAD`, `SUPERVISOR`, `STAFF`, `CHEF`, `FRONT_DESK`, `HOUSEKEEPING`, `MAINTENANCE`, `INVENTORY_MANAGER`, `VENDOR_MANAGER`, `SECURITY`, `FINANCE`, `HR`, `GUEST`

Permissions: `view`, `create`, `update`, `approve`, `assign`, `resolve`, `cancel`, `manage`

---

## Part 1 Complete

- Express + TypeScript backend with MongoDB Atlas
- JWT auth (register, login, me, logout)
- Role-based + permission-based authorization
- Zod validation, Helmet, CORS, rate limiting
- Health check endpoint
- Admin seed script
- React + Vite + TypeScript + Tailwind CSS v4 frontend
- Protected/public route system
- Login page, Dashboard, Profile, Settings
- Sidebar + TopNav with profile menu + logout
- Reusable RBAC foundation for future modules
