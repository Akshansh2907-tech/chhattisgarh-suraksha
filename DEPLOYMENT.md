# 🚀 Quick Deployment Guide

## Option 1: Docker (Recommended - 5 minutes)

```bash
# 1. Get API keys
# WAQI: https://aqicn.org/api/
# Twilio: https://www.twilio.com/console

# 2. Setup environment
cp .env.example .env
nano .env  # Add your API keys

# 3. Deploy
docker-compose up -d

# 4. Verify
curl http://localhost/api/status

# Done! Access at http://localhost
```

## Option 2: Local Development

```bash
# Terminal 1 - Database
createdb chhattisgarh_suraksha

# Terminal 2 - Backend
cd backend
npm install
# 🚀 Deployment & Operations Guide

This document summarizes recommended deployment and operational steps for running the application in Docker or in a local development environment.

## Recommended: Docker (quick)

1. Copy env and edit secrets/API keys:

```bash
cp .env.example .env
# Edit .env and fill in WAQI_API_KEY, TWILIO_*, JWT_SECRET, DATABASE_URL (if not using internal postgres)
```

2. Build and start services:

```bash
docker-compose up -d --build
```

3. Verify:

```bash
curl http://localhost:5000/api/status    # backend
curl http://localhost:3000               # frontend (nginx)
```

Notes:
- The compose file builds the frontend and serves static files through nginx on port `3000` by default.
- Backend API listens on port `5000` in the container and is exposed to the host as configured in `docker-compose.yml`.

## Local Development (run separately)

### Start Postgres (if not using Docker)

```bash
createdb chhattisgarh_suraksha
```

### Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env (DATABASE_URL, JWT_SECRET, WAQI_API_KEY, TWILIO_*, etc.)
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# set VITE_API_URL=http://localhost:5000/api if needed
npm run dev
```

Frontend dev runs on `5173` by default; the production frontend build is served by nginx (docker) on port `3000`.

## Environment variables (examples)

Put required secrets into `.env` (do not commit):

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/chhattisgarh_suraksha
JWT_SECRET=replace_with_strong_secret
WAQI_API_KEY=your_waqi_api_key
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

## Production deployment (summary)

1. Prepare a production `.env.production` with all secrets and production DB URL.
2. Build and deploy using the production env file:

```bash
docker-compose --env-file .env.production up -d --build
```

3. Configure reverse proxy / Load balancer and TLS (Let's Encrypt / managed certs).

Notes:
- For multi-instance deployments, use an external pub/sub (Redis) to coordinate WebSocket messages across instances.
- Use a managed Postgres and enable automated backups.

## Health checks & logs

```bash
# Backend health
curl http://localhost:5000/api/status

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Database quick check (containerized Postgres)
docker-compose exec postgres psql -U postgres -d chhattisgarh_suraksha -c "SELECT 1"
```

## Common troubleshooting

- If ports are in use, change mappings in `docker-compose.yml`.
- If database connection fails, ensure `DATABASE_URL` points to the correct host and port.
- If `sharp` (image processing) fails to install, add the OS packages for libvips/build tools in the backend Dockerfile or install them on your host.

## Backups & updates

Backup DB:

```bash
docker-compose exec postgres pg_dump -U postgres chhattisgarh_suraksha > backup.sql
```

Restore:

```bash
docker-compose exec -T postgres psql -U postgres chhattisgarh_suraksha < backup.sql
```

Update app (zero-downtime considerations optional):

```bash
git pull
docker-compose down
docker-compose up -d --build
```

## Scaling notes

- To scale backend replicas with docker-compose:

```bash
docker-compose up -d --scale backend=3
```

- For production scale use Kubernetes or a proper orchestrator and an external shared session/pubsub (Redis) for WebSocket broadcasting.

## Model persistence & ML service deployment

The Python ML microservice uses ONNX models stored under `/app/models`. Models can be large and should be persisted separately from the container image. We recommend using a named Docker volume (`models_data`) or an external object store for production.

Recommended docker-compose fragment (example):

```yaml
volumes:
	models_data:

services:
	ml-service:
		image: python-ml-service:latest
		volumes:
			- models_data:/app/models
		environment:
			- ONNX_MODEL_PATH=/app/models/resnet50.onnx
			- IMAGENET_LABELS_PATH=/app/models/imagenet_labels.json
			- PLACES_ONNX_PATH=/app/models/places365.onnx
			- PLACES_LABELS_PATH=/app/models/places365_labels.txt
			- PLACES_ONNX_URL=https://<YOUR_TRUSTED_URL>/places365.onnx
```

How it works:
- On container start the ml-service `entrypoint.sh` will ensure the ImageNet model and labels exist. It will also attempt a best-effort download of Places labels and — if you set `PLACES_ONNX_URL` — attempt to download the Places ONNX artifact into `/app/models` so it persists across restarts.
- Keep the `models_data` volume backed up or seeded in CI to reduce container startup time in environments where network access is restricted.
- If you prefer, pre-populate the `models_data` volume with model files on the host before starting containers:

```bash
mkdir -p /path/to/models_data
# copy or download models to /path/to/models_data
docker volume create --name models_data
docker run --rm -v models_data:/data -v /path/to/models_data:/seed alpine sh -c "cp -r /seed/* /data/ || true"
```

Security & operational notes:
- Only set `PLACES_ONNX_URL` to a trusted, authenticated URL (signed release or internal artifact repository). Downloading large binaries at container start can slow restarts and increase failure modes if the network is unreliable.
- Consider using a signed checksum (SHA256) for model artifacts and verify after download before starting the service.
- For enterprise/prod, use an internal artifact repository (S3, Artifactory, Nexus) and a pull-through cache to avoid relying on external public URLs.

Rolling updates:
- When updating models in the volume, deploy a rolling restart of ml-service replicas to pick up the new model file. If you require zero-downtime model swap, use a separate model-serving system that supports atomic versioning (Triton, KFServing, or similar).

## Need help?

Open an issue on the repository with logs and steps to reproduce.
