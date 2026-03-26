# Python ML Microservice

Lightweight FastAPI microservice that powers rapid ML heuristics for the Chhattisgarh Suraksha hackathon build.

## What it does
- Scores uploaded images for environmental relevance (vegetation, sky/water, texture diversity).
- Runs a ResNet50 ImageNet classifier (ONNX, ~100 MB) via ONNX Runtime to pick up semantic cues like trees, roads, rivers, smokestacks, etc.
- Rejects/flags images that lack enough environmental feature categories or look AI-generated.
- Returns a structured decision payload consumed by the Node.js backend when media is uploaded.

## Quick start
```bash
cd python-ml-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Download the ONNX model + labels if they are not present
mkdir -p models
curl -L -o models/resnet50.onnx https://github.com/onnx/models/raw/main/vision/classification/resnet/model/resnet50-v1-12.onnx
curl -L -o models/imagenet_labels.json https://raw.githubusercontent.com/anishathalye/imagenet-simple-labels/master/imagenet-simple-labels.json
export ONNX_MODEL_PATH=$(pwd)/models/resnet50.onnx
export IMAGENET_LABELS_PATH=$(pwd)/models/imagenet_labels.json
uvicorn main:app --host 0.0.0.0 --port 8001
```

### Optional: Places365 scene classifier

This microservice now supports an optional Places365-style scene classifier (ONNX). When present, the service will prefer strong scene-level predictions from Places to make safer "environment vs non-environment" decisions (for example: classroom vs park). The Places model is optional — if it's not provided the service continues to run using heuristics + the ImageNet classifier.

To enable Places365 support:

1. Place a Places ONNX model at `models/places365.onnx` (or set `PLACES_ONNX_PATH` to the file path).
2. The service expects a labels file at `models/places365_labels.txt` (one label per line). An entrypoint attempt is included to fetch `categories_places365.txt` into that path if the container has network access.

Environment variables supported (examples):

```bash
export ONNX_MODEL_PATH=/app/models/resnet50.onnx
export IMAGENET_LABELS_PATH=/app/models/imagenet_labels.json
export PLACES_ONNX_PATH=/app/models/places365.onnx        # optional
export PLACES_LABELS_PATH=/app/models/places365_labels.txt # optional
export ONNX_TOP_K=8
export MIN_ENV_FEATURE_CATEGORIES=2
```

Notes:
- The entrypoint script in the Docker image will attempt to download ImageNet labels and Places labels (best-effort). It will not fail the container if the Places files or model are missing.
- Places model files are typically large. We intentionally do not auto-download a Places ONNX in the entrypoint to avoid fragile large-network fetches during container start. If you would like, we can add a trusted download step to the entrypoint.

### Testing the service

Send a POST to `/analyze-image` with a JSON body:

```json
{ "image_base64": "<BASE64>", "mime_type": "image/jpeg" }
```

If Places predictions are available the JSON response will include a `places_top` field with the top Places label and score. Strong Places non-environment labels (for example `classroom`, `office`) will cause the service to return `reject_non_environment` for safety.

> First install downloads the ONNX model (~100 MB) and ONNX Runtime CPU wheels (~15 MB). Docker builds fetch these automatically.

The backend expects the service at `http://localhost:8001/analyze-image`. Override with `PYTHON_ML_SERVICE_URL` in the backend environment if you deploy elsewhere.

## API
- `GET /health` – readiness check.
- `POST /analyze-image` – body `{ "image_base64": "...", "mime_type": "image/jpeg" }`.

Response example:
```json
{
  "decision": "accept",
  "label": "environment",
  "environment_score": 0.78,
  "is_ai_generated": false,
  "confidence": 0.86,
  "cues": ["Vegetation dominant", "Natural texture variance"],
  "reason": "Environmental features detected: vegetation (park bench), water (lakeside).",
  "detected_features": ["vegetation", "water"],
  "top_predictions": [
    {"label": "lakeside", "score": 0.31},
    {"label": "seashore", "score": 0.22},
    {"label": "park bench", "score": 0.11}
  ]
}
```

Decisions include `accept`, `needs_review`, `reject_non_environment`, and `reject_ai_generated`. Tune `MIN_ENV_FEATURE_CATEGORIES` (defaults to 2 distinct feature buckets) or `ONNX_TOP_K` to adjust sensitivity.

## Notes
- ResNet50 inference via ONNX Runtime remains fast on CPU (~20-30 ms per image on modern hardware).
- For production, you can swap in a domain-specific classifier/segmenter and refine the feature keywords/thresholds without code changes to the Node backend.

