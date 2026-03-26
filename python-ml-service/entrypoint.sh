#!/bin/sh
set -e

# Ensure models dir exists
mkdir -p /app/models

# Default model/labels paths (can be overridden via env)
: ${ONNX_MODEL_PATH:=/app/models/resnet50.onnx}
: ${IMAGENET_LABELS_PATH:=/app/models/imagenet_labels.json}
: ${PLACES_LABELS_PATH:=/app/models/places365_labels.txt}
: ${PLACES_ONNX_PATH:=/app/models/places365.onnx}
: ${PLACES_ONNX_URL:=""}

# Download model and labels only if they are missing. This keeps builds fast and allows
# the models to be persisted in the `models_data` volume when running containers.
if [ ! -f "$ONNX_MODEL_PATH" ]; then
  echo "Model not found at $ONNX_MODEL_PATH — downloading..."
  curl -L --retry 5 --retry-delay 5 -o "$ONNX_MODEL_PATH" https://github.com/onnx/models/raw/main/vision/classification/resnet/model/resnet50-v1-12.onnx || {
    echo "Warning: model download failed" >&2
  }
else
  echo "Model already present: $ONNX_MODEL_PATH"
fi

if [ ! -f "$IMAGENET_LABELS_PATH" ]; then
  echo "Labels not found at $IMAGENET_LABELS_PATH — downloading..."
  curl -L --retry 5 --retry-delay 5 -o "$IMAGENET_LABELS_PATH" https://raw.githubusercontent.com/anishathalye/imagenet-simple-labels/master/imagenet-simple-labels.json || {
    echo "Warning: labels download failed" >&2
  }
else
  echo "Labels already present: $IMAGENET_LABELS_PATH"
fi

# Try to download Places365 labels (best-effort). The ONNX model is optional and may not
# be available in all environments; if you place a Places ONNX at PLACES_ONNX_PATH it will
# be loaded by the service.
if [ ! -f "$PLACES_LABELS_PATH" ]; then
  echo "Places labels not found at $PLACES_LABELS_PATH — downloading..."
  curl -L --retry 5 --retry-delay 5 -o "$PLACES_LABELS_PATH" https://raw.githubusercontent.com/CSAILVision/places365/master/categories_places365.txt || {
    echo "Warning: Places labels download failed" >&2
  }
else
  echo "Places labels already present: $PLACES_LABELS_PATH"
fi

# Optionally download a Places365 ONNX model if a URL is provided via PLACES_ONNX_URL
if [ -n "$PLACES_ONNX_URL" ]; then
  if [ ! -f "$PLACES_ONNX_PATH" ]; then
    echo "Places ONNX not found at $PLACES_ONNX_PATH — downloading from $PLACES_ONNX_URL"
    curl -L --retry 5 --retry-delay 5 -o "$PLACES_ONNX_PATH" "$PLACES_ONNX_URL" || {
      echo "Warning: failed to download Places ONNX from $PLACES_ONNX_URL" >&2
    }
  else
    echo "Places ONNX already present: $PLACES_ONNX_PATH"
  fi
else
  echo "PLACES_ONNX_URL not set — skipping Places ONNX download (optional)"
fi

# Execute the main process (CMD)
exec "$@"
