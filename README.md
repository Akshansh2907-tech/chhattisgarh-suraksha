# Chhattisgarh Suraksha - Environmental Safety Platform

Full-stack environmental monitoring platform with ML insights, blockchain integration, and real-time analytics.

## 🚀 Quick Start (Docker)

```bash
cp .env.example .env    # Edit with your API keys
docker-compose up -d    # Start all services
```
Access: http://localhost
# Chhattisgarh Suraksha - Environmental Safety Platform

This repository contains a full-stack application for environmental monitoring, citizen reporting, and community engagement. It combines a Node.js backend, a React + Vite frontend, a PostgreSQL database, and optional blockchain integrations for immutable report storage.

This README gives up-to-date, actionable instructions for running the app locally and in Docker, how to run the frontend and backend in development, and helpful tips for debugging common issues.

## Quick links
- Backend: `http://localhost:5000` (API base: `/api`)
- Frontend (dev): `http://localhost:5173`
- Frontend (docker/nginx): `http://localhost:3000`
- Python ML service: `http://localhost:8001`

## 🚀 Quick Start (recommended: Docker)

1. Copy environment file and edit secrets/API keys:

```bash
cp .env.example .env
# Edit .env and backend/.env (if separate) with your secrets
```

2. Build and start all services (recommended):

```bash
docker-compose up -d --build
```

3. Verify services are running:

```bash
# API
curl http://localhost:5000/api/status

# Frontend (nginx) — if using dockerized frontend
curl http://localhost:3000
```

Docker services brought up by this command:
- `postgres` (database)
- `backend` (Node.js API)
- `frontend` (nginx serving the React build)
- `ganache` (local blockchain node)
- `ml-service` (FastAPI image vetting microservice on port 8001)

Notes:
- The docker-compose setup builds the frontend into static assets and serves them via nginx on port `3000` by default. The backend runs on port `5000`.
- If you prefer to run frontend and backend separately during development, see the Local Development section below.

## Local Development

### Backend

Requirements: Node.js (>= 18), npm, PostgreSQL.

```bash
cd backend
npm install
cp .env.example .env
# Edit .env (DATABASE_URL, JWT_SECRET, WAQI_API_KEY, TWILIO_*, PYTHON_ML_SERVICE_URL, etc.)
npm run dev
```

The backend listens on port 5000 by default. The Express server auto-creates the required tables the first time it runs.

### Frontend

Requirements: Node.js, npm

```bash
cd frontend
npm install
# If proxying to a running backend in development, set VITE_API_URL in frontend/.env to http://localhost:5000/api
cp .env.example .env
npm run dev
```

The Vite dev server runs on port 5173 by default.

### Python microservice (image vetting)

```
cd python-ml-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

Set `PYTHON_ML_SERVICE_URL` in the backend environment if you run the service on a different host/port. The backend falls back to `http://localhost:8001/analyze-image` when unset.

### Database (local)

Create a local PostgreSQL database and point `DATABASE_URL` to it (or use the docker-compose Postgres service):

```bash
createdb chhattisgarh_suraksha
```

The backend will create tables automatically on startup. If you need to reset:

```bash
docker-compose down -v  # removes named volumes including DB data (if using docker-compose)
```

## Generating a JWT for tests

If you need a valid JWT that uses the server's `JWT_SECRET` (useful for calling protected endpoints from your host), generate it inside the backend container so the secret matches:

```bash
# Example: generate a token for user id 1 (requires node inside container)
docker-compose exec backend node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({ id: 1 }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '7d' }));"
```

Alternatively, call login/OTP flows via the frontend to obtain tokens in normal operation.

## API highlights

The backend serves routes under `/api`. Some commonly used endpoints:

- `GET /api/metrics/current` — current environmental metrics
- `GET /api/metrics/alerts` — active alerts
- `POST /api/reports/submit` — submit a citizen report (auth required)
- `POST /api/metrics/update` — force update of real-time metrics (admin)
- `POST /api/auth/send-otp` and `POST /api/auth/verify-otp` — authentication via phone OTP

See the code under `backend/src/routes` for the full list of endpoints.

## Media analysis & image spam detection (developer note)

We are in the process of adding server-side image analysis to detect duplicate/spam or low-quality images. This requires additional native dependencies (for example, `sharp`), which may need extra packages in the Docker image or on your system.

If you plan to enable image analysis locally, install the native libs required by `sharp` (libvips). In Docker-based builds this is handled in the backend Dockerfile — check `backend/Dockerfile` and the CI/build environment.

## Tech stack and rationale

Here's a concise summary of the main technologies used in this project and why they are a good fit for the product goals.

- Node.js (Express) — backend API
	- Why: fast development velocity, large ecosystem, great support for JSON APIs and middleware patterns. Express integrates well with Postgres drivers, WebSocket servers, and existing Node developer workflows. It's excellent for a hackathon because you can iterate quickly and add features like health checks, migrations, and middleware without heavy ceremony.

- React + Vite — frontend
	- Why: Vite gives extremely fast dev reloads and small opinionated builds; React is flexible for UI components, state management, and progressive enhancement. The combination lets us build a snappy client-side app that can also be prebuilt and served as static assets by nginx for simple deployments.

- PostgreSQL — primary datastore
	- Why: reliable relational DB with strong JSONB support and ACID transactions. We use SQL for reports and gamification logic where strong consistency is important (points, reporting, moderation). JSONB is used for flexible analysis payloads from the ML service.

- Python + FastAPI + ONNX Runtime (ML microservice)
	- Why: FastAPI is fast to iterate with, provides automatic docs, and is simple to containerize. ONNX Runtime gives us a portable, framework-agnostic way to run models (ResNet, Places, or detectors) on CPU or GPU without tying to a particular DL stack. Splitting ML into a microservice keeps the Node API lightweight and isolates heavy deps.

- Docker Compose — local orchestration
	- Why: simple reproducible local environment that contains Postgres, backend, frontend, ML service, and optional blockchain node (Ganache). Good balance between parity with production and local developer ergonomics.

- Websockets / Real-time alerts
	- Why: Some features (alerts, live moderation) benefit from real-time push rather than polling. Websockets let us broadcast events (new alerts, moderation status) to connected clients with low latency.

Why this stack is excellent for our use case
- Fast iteration: Node + React + FastAPI lets the team move quickly while keeping clear service boundaries (API, frontend, ML service). The split allows experimenting with heavier ML models without overloading the API server or slowing development.
- Portability & scale paths: Docker Compose gives local reproducibility and the services map cleanly to cloud managed services (managed Postgres, containerized services behind a load balancer). The ML microservice uses ONNX for portability between CPU/GPU environments.
- Safety & auditing: Using Postgres and careful transaction boundaries helps ensure points and report state are recorded atomically. The blockchain integration (optional) provides an append-only record for audit/demonstration use-cases.
- Incremental ML rollout: The architecture supports heuristic-first and model-backed decisions. You can deploy the heuristics immediately, add a scene classifier (Places365) for better precision, and later add object detectors — all without breaking the frontend contract.

If you'd like, I can add a short `ARCHITECTURE.md` that diagrams service interactions (frontend → backend → ml-service → db → optional blockchain) and lists scale considerations (caching, worker queues, model-serving suggestions). Would you like that added next?

## Production deployment notes

- Use a strong `JWT_SECRET` and secure environment variables (never check them into source control).
- Provide real WAQI and Twilio credentials in production `env` file.
- Use a managed PostgreSQL service and configure automated backups.
- Configure SSL/TLS (Let's Encrypt or a managed cert provider).
- For horizontal scaling add a load balancer and use an external pub/sub (Redis) for WebSocket/real-time coordination.

## Troubleshooting & common issues

- Backend logs:
	```bash
	docker-compose logs backend -f
	```
- Frontend logs (nginx):
	```bash
	docker-compose logs frontend -f
	```
- DB errors: check that `DATABASE_URL` is correct and that Postgres is reachable.
- If `sharp` fails to install, install libvips on your system or add build deps to the Docker image.

## Contributing

1. Fork repository
2. Create feature branch
3. Run tests and linting (if added)
4. Open a pull request with a clear summary of changes

## License

MIT

---

If you'd like, I can also update `DEPLOYMENT.md` and `frontend/README.md` with matching up-to-date instructions — I will apply those updates next.
## 🤝 Contributing
