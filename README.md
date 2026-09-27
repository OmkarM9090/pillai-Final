# Smart Resort 360

> AI-powered resort operations, guest experience, and revenue intelligence platform.

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
```

### Demo logins (password: `demo123`)

| Persona | Email | Lands on |
|---------|-------|----------|
| Manager | `manager@smartresort.demo` | Command Center Dashboard |
| Supervisor | `housekeeping.supervisor@smartresort.demo` | Dashboard |
| Worker | `housekeeper@smartresort.demo` | Worker Portal |
| Guest | `guest@smartresort.demo` | Guest Concierge Portal |
| Super Admin | `admin@resort360.com` | Dashboard (password: `Admin@123456`) |

### 3-minute demo script

1. **Guest portal** (`guest@smartresort.demo`) → type *"The AC in my room is broken"* → AI concierge classifies intent, sets priority/SLA and auto-dispatches staff.
2. Repeat the AC complaint from 2 more rooms → **Manager → Incidents** → *Cluster Complaints* → systemic issue detected, master ticket + action card created.
3. **Worker portal** (`housekeeper@smartresort.demo`) → accept → start → complete the task; guest can then rate it (low rating triggers automatic service recovery).
4. **Manager → Time Machine** → push occupancy to 95% + storm severity → run simulation → *Create Action Plan* → approve it in **Council & Approval**.
5. **Dashboard** shows live occupancy, department pressure, critical incidents and the audit trail the whole time (auto-refreshes).

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
