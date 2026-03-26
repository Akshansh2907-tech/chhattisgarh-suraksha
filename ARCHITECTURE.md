# Architecture Overview

This document describes the high-level architecture of the Chhattisgarh Suraksha platform, the responsibilities of each service, data flows, and operational considerations for running and scaling the system.

## Services & responsibilities

- frontend (React + Vite)
  - Single-page application that provides the citizen reporting UI, location capture, photo upload, and dashboards.
  - Produces static builds that can be served by nginx for simple deployments.

- backend (Node.js + Express)
  - Primary HTTP API for authentication, reports, metrics, gamification, and moderation.
  - Orchestrates media uploads, stores normalized metadata in Postgres, and calls the ML microservice for image analysis.
  - Maintains transactional consistency for reports and user activity points.

- python-ml-service (FastAPI + ONNX Runtime)
  - Image vetting microservice that runs lightweight heuristics and optional ONNX classifiers (ResNet/ImageNet, optional Places365 scene classifier, detectors) to decide if a photo represents a real environmental scenario.
  - Exposes a small JSON API (`/analyze-image`) consumed by the backend.
  - Designed to be optional and best-effort: backend gracefully proceeds when the service is unavailable.

- postgres
  - Relational datastore for users, reports, media metadata, gamification points, and other structured data.
  - Uses JSONB columns for flexible analysis payloads returned from the ML service.

- optional: ganache / blockchain service
  - An append-only chain used for demo/auditing purposes. Reports can be optionally anchored to the chain for immutable audit trails.

## Data flow (happy path)

1. User opens the frontend and creates a report (selects issue type, captures location, attaches photos).
2. Frontend uploads images via the backend media route (`POST /api/media/upload`) using an "upload-first" approach:
   - The backend saves the file and runs `python-ml-service` to analyze the image.
   - The backend stores metadata in `media_features` with analysis payload, spam_score and status.
   - The backend returns an `asset_id` to the frontend. If the upload fails (offline or server error), the frontend falls back to local storage and uses a `local_...` id.
3. When the user submits the report, the frontend includes the list of `asset_id`s.
4. The backend inserts the report using a DB transaction, validates the referenced `asset_id`s against `media_features`, and then:
   - awards points if media is verified and not flagged, or
   - withholds/penalizes points if media is unverified, rejected, or AI-generated.
5. The backend optionally forwards a sanitized report summary to the blockchain for auditing.
6. Frontend refreshes user stats and triggers UI updates.

## Image vetting & model strategy

- Heuristics first: color distribution, entropy, texture variance, and simple HSV-based masks detect vegetation, water/sky, and infrastructure. These heuristics are fast and reduce false positives for simple cases.
- Classifier augmentation: an ImageNet-style classifier (ResNet via ONNX) provides semantic cues ("tree", "smokestack", "seashore").
- Optional scene classifier (Places365): when present, the Places model helps decide scene-level context (indoor vs outdoor). We prefer strong non-environment predictions from Places to avoid accepting classroom or indoor images.
- Future: integrate object detectors (YOLO) or segmentation models for more precise detections (e.g., smoke plumes, water bodies). These are more expensive and may be served behind a queue or dedicated model server.

## Storage: model persistence & volumes

- Models are large and should be persisted in a named Docker volume (e.g. `models_data`) or an external object store.
- The docker-compose configuration mounts `/app/models` from a named volume so models downloaded at container runtime are reused across restarts and do not inflate image build times.
- Example volume usage (docker-compose):

```yaml
volumes:
  models_data:
services:
  ml-service:
    volumes:
      - models_data:/app/models
```

## Scaling recommendations

- ML service:
  - For low traffic, a single CPU-based container with ONNX Runtime is sufficient.
  - For higher throughput, run multiple ml-service replicas behind a lightweight load-balancer and use the models_data volume mounted on each host or a shared network filesystem.
  - For latency-sensitive production, use GPU-enabled instances (ONNX Runtime GPU provider) or a dedicated model server (Triton / TorchServe) and serve models via gRPC/HTTP.

- Backend:
  - Scale horizontally with a load balancer. Use Redis or another pub/sub for WebSocket event coordination.
  - Ensure a shared DB and central object storage for assets when scaling across hosts.

## Observability & monitoring

- Logs: collect backend and ml-service logs (stdout) using a centralized logging system (ELK, Loki, etc.).
- Metrics: instrument HTTP latencies, request rates, ML inference duration, and spam/reject rates. Expose Prometheus metrics from the services where feasible.
- Alerts: watch for spikes in `rejected_*` decisions (may indicate model drift), high ml-service latency, or DB errors.

## Security & operational notes

- Use strong JWT secrets and rotate credentials periodically.
- Sanitize and limit upload sizes at the reverse proxy/nginx layer to avoid large payload DoS.
- Store secrets in environment variables or a secret manager, not in repository.
- For production, use managed Postgres and enable automated backups.

## Next steps / roadmap

- Add an architectural diagram (SVG) with service interactions and recommended network ports.
- Add an optional dedicated model-serving stack (Triton / KFServing) for heavier detectors/segmenters.
- Implement a moderation review queue and admin UI for flagged reports.

---

This file should be kept concise and high level; operational runbooks and deep dive model-serving docs belong in `DEPLOYMENT.md` or `docs/`.
