from __future__ import annotations

import base64
import json
import math
import os
from dataclasses import dataclass
from io import BytesIO
from typing import Dict, List, Optional

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from PIL import Image, ImageStat, ImageFilter


app = FastAPI(
    title="Chhattisgarh Suraksha ML Microservice",
    version="0.2.0",
    description=(
        "Image vetting microservice for the hackathon build. Combines lightweight "
        "heuristics with an ONNX ImageNet classifier to decide whether a citizen "
        "report photo contains genuine environmental context."
    ),
)


class AnalyzeImageRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image (no data URI prefix)")
    mime_type: Optional[str] = Field(None, description="Declared MIME type from uploader")


class Prediction(BaseModel):
    label: str
    score: float


class AnalyzeImageResponse(BaseModel):
    decision: str
    label: str
    environment_score: float
    is_ai_generated: bool
    confidence: float
    cues: List[str]
    reason: str
    detected_features: List[str]
    top_predictions: List[Prediction]


@dataclass
class HeuristicResult:
    environment_score: float
    ai_suspect: bool
    cues: List[str]


MIN_FEATURE_CATEGORIES = int(os.getenv("MIN_ENV_FEATURE_CATEGORIES", "2"))
MODEL_PATH = os.getenv("ONNX_MODEL_PATH", "/app/models/resnet50.onnx")
LABELS_PATH = os.getenv("IMAGENET_LABELS_PATH", "/app/models/imagenet_labels.json")
TOP_K = int(os.getenv("ONNX_TOP_K", "8"))

# Optional Places365 model (scene classifier). If present, we'll prefer its scene-level
# judgement for environment/non-environment decisions. This file may be absent in dev
# environments; code will gracefully skip it.
PLACES_MODEL_PATH = os.getenv("PLACES_ONNX_PATH", "/app/models/places365.onnx")
PLACES_LABELS_PATH = os.getenv("PLACES_LABELS_PATH", "/app/models/places365_labels.txt")

_PLACES_SESSION: Optional[ort.InferenceSession] = None
_PLACES_INPUT_NAME: Optional[str] = None
_PLACES_LABELS: Optional[List[str]] = None

_CLASSIFIER_SESSION: Optional[ort.InferenceSession] = None
_CLASSIFIER_INPUT_NAME: Optional[str] = None
_CLASSIFIER_LABELS: Optional[List[str]] = None

FEATURE_KEYWORDS: Dict[str, List[str]] = {
    "vegetation": [
        "tree", "forest", "park", "wood", "jungle", "garden", "meadow", "grass",
        "shrub", "vine", "lawn", "field", "grove", "bamboo"
    ],
    "water": [
        "river", "lake", "pond", "sea", "ocean", "waterfall", "stream", "canal",
        "lagoon", "bay", "shore", "marsh", "dam"
    ],
    "infrastructure": [
        "road", "street", "bridge", "building", "tower", "highway", "railway",
        "airport", "viaduct", "pier", "factory", "warehouse", "power plant",
        "overpass", "lock", "dam"
    ],
    "pollution": [
        "smoke", "smokestack", "chimney", "landfill", "garbage", "dump", "oil",
        "fume", "refinery", "pollution", "bulldozer", "excavator"
    ]
}


def _ensure_classifier() -> None:
    global _CLASSIFIER_SESSION, _CLASSIFIER_INPUT_NAME, _CLASSIFIER_LABELS

    if _CLASSIFIER_SESSION is None:
        if not os.path.exists(MODEL_PATH):
            raise HTTPException(status_code=500, detail="ONNX model not found on server")
        _CLASSIFIER_SESSION = ort.InferenceSession(
            MODEL_PATH,
            providers=["CPUExecutionProvider"]
        )
        _CLASSIFIER_INPUT_NAME = _CLASSIFIER_SESSION.get_inputs()[0].name

    if _CLASSIFIER_LABELS is None:
        if not os.path.exists(LABELS_PATH):
            raise HTTPException(status_code=500, detail="ImageNet labels file missing on server")
        with open(LABELS_PATH, "r", encoding="utf-8") as handle:
            labels = json.load(handle)
        if not isinstance(labels, list) or len(labels) < 1000:
            raise HTTPException(status_code=500, detail="Invalid ImageNet labels file")
        _CLASSIFIER_LABELS = labels

    # Try to load optional Places365 classifier (best-effort)
    global _PLACES_SESSION, _PLACES_INPUT_NAME, _PLACES_LABELS
    try:
        if _PLACES_SESSION is None and os.path.exists(PLACES_MODEL_PATH):
            try:
                _PLACES_SESSION = ort.InferenceSession(PLACES_MODEL_PATH, providers=["CPUExecutionProvider"])
                _PLACES_INPUT_NAME = _PLACES_SESSION.get_inputs()[0].name
                print(f"Loaded Places365 ONNX model from {PLACES_MODEL_PATH}")
            except Exception as e:
                print(f"Failed to load Places365 model: {e}")

        if _PLACES_LABELS is None and os.path.exists(PLACES_LABELS_PATH):
            try:
                with open(PLACES_LABELS_PATH, "r", encoding="utf-8") as fh:
                    # Some places label files list one label per line, possibly with indexes
                    raw = [line.strip() for line in fh.readlines() if line.strip()]
                    # Normalize: if line starts with number and space, strip the leading token
                    labels = [l.split(' ', 1)[-1].strip().replace(' ', '_') for l in raw]
                _PLACES_LABELS = labels
                print(f"Loaded Places365 labels from {PLACES_LABELS_PATH} ({len(labels)} entries)")
            except Exception as e:
                print(f"Failed to load Places365 labels: {e}")
    except Exception:
        # Don't let optional model failures impact service startup
        pass


def _run_classifier(image: Image.Image) -> List[Dict[str, float]]:
    # Run the ONNX classifier (ImageNet-style) and return top-k labels with scores.
    _ensure_classifier()
    assert _CLASSIFIER_SESSION is not None and _CLASSIFIER_INPUT_NAME is not None

    # Preprocess: resize to 224x224, convert to float, normalize using ImageNet mean/std
    target_size = (224, 224)
    img = image.resize(target_size).convert("RGB")
    arr = np.asarray(img).astype(np.float32) / 255.0
    # ImageNet normalization
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr = (arr - mean) / std
    # Convert HWC to NCHW
    arr = np.transpose(arr, (2, 0, 1)).astype(np.float32)
    arr = np.expand_dims(arr, axis=0)

    # Build inputs (some ONNX exports expect different input names/shapes; we rely on default here)
    inputs = { _CLASSIFIER_INPUT_NAME: arr }

    try:
        outputs = _CLASSIFIER_SESSION.run(None, inputs)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Classifier run failed: {exc}")

    # Many ImageNet ONNX exports return a single logits array
    logits = outputs[0]
    # Ensure shape (1, N)
    if logits.ndim == 4:
        # e.g., some nets return (1, C, 1, 1)
        logits = logits.reshape((logits.shape[0], -1))
    if logits.shape[0] != 1:
        logits = logits[0]
    else:
        logits = logits[0]

    # softmax
    exp = np.exp(logits - np.max(logits))
    probs = exp / exp.sum()

    # Top-K
    topk_idx = np.argsort(probs)[-TOP_K:][::-1]
    preds: List[Dict[str, float]] = []
    for idx in topk_idx:
        label = _CLASSIFIER_LABELS[idx] if _CLASSIFIER_LABELS and idx < len(_CLASSIFIER_LABELS) else str(idx)
        score = float(probs[idx])
        preds.append({"label": label, "score": round(score, 4)})

    return preds


def _run_places_classifier(image: Image.Image) -> Optional[List[Dict[str, float]]]:
    """Run optional Places365-style ONNX classifier if available. Returns top-K
    labels with scores or None if model/labels are not present."""
    # Ensure places model is loaded
    try:
        _ensure_classifier()
    except HTTPException:
        # _ensure_classifier may throw if base classifier missing; ignore for places
        pass

    if _PLACES_SESSION is None or _PLACES_INPUT_NAME is None or _PLACES_LABELS is None:
        return None

    # Preprocess similar to ImageNet (many places models also accept 224x224 RGB)
    target_size = (224, 224)
    img = image.resize(target_size).convert("RGB")
    arr = np.asarray(img).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr = (arr - mean) / std
    arr = np.transpose(arr, (2, 0, 1)).astype(np.float32)
    arr = np.expand_dims(arr, axis=0)

    inputs = { _PLACES_INPUT_NAME: arr }
    try:
        outputs = _PLACES_SESSION.run(None, inputs)
    except Exception as exc:
        print(f"Places classifier run failed: {exc}")
        return None

    logits = outputs[0]
    if logits.ndim == 4:
        logits = logits.reshape((logits.shape[0], -1))
    if logits.shape[0] != 1:
        logits = logits[0]
    else:
        logits = logits[0]

    exp = np.exp(logits - np.max(logits))
    probs = exp / exp.sum()

    topk_idx = np.argsort(probs)[-TOP_K:][::-1]
    preds: List[Dict[str, float]] = []
    for idx in topk_idx:
        label = _PLACES_LABELS[idx] if _PLACES_LABELS and idx < len(_PLACES_LABELS) else str(idx)
        score = float(probs[idx])
        preds.append({"label": label, "score": round(score, 4)})
    return preds


def _rgb_to_hsv(arr: np.ndarray) -> np.ndarray:
    # arr: HxWx3 in [0,1]
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    cmax = np.max(arr, axis=-1)
    cmin = np.min(arr, axis=-1)
    delta = cmax - cmin + 1e-8
    hue = np.zeros_like(cmax)
    mask = delta > 1e-8
    r_eq = (cmax == r) & mask
    g_eq = (cmax == g) & mask
    b_eq = (cmax == b) & mask
    hue[r_eq] = ((g[r_eq] - b[r_eq]) / delta[r_eq]) % 6
    hue[g_eq] = ((b[g_eq] - r[g_eq]) / delta[g_eq]) + 2
    hue[b_eq] = ((r[b_eq] - g[b_eq]) / delta[b_eq]) + 4
    hue = hue / 6.0
    sat = delta / (cmax + 1e-8)
    val = cmax
    hsv = np.stack([hue, sat, val], axis=-1)
    return hsv

def _detect_environmental_features(image: Image.Image) -> Dict[str, List[str]]:
    # Resize small for speed and robustness
    small = image.resize((256, 256))
    arr = np.asarray(small).astype(np.float32) / 255.0
    hsv = _rgb_to_hsv(arr)

    hue = hsv[..., 0]
    sat = hsv[..., 1]
    val = hsv[..., 2]

    # Heuristic masks
    vegetation_mask = (sat > 0.25) & (val > 0.2) & (
        (
            (hue >= (60/360)) & (hue <= (170/360))  # greenish hues
        )
        | ((arr[...,1] > 1.1 * arr[...,0]) & (arr[...,1] > 1.1 * arr[...,2]))
    )

    water_sky_mask = (val > 0.25) & (
        (
            (hue >= (180/360)) & (hue <= (255/360))  # cyan-blue
        )
        | (arr[...,2] > 1.15 * arr[...,0])
    )

    # Infrastructure via edges + low saturation grays (roads/buildings)
    edges = small.convert("L").filter(ImageFilter.FIND_EDGES)
    edges_np = np.asarray(edges).astype(np.float32) / 255.0
    edge_dense = edges_np > 0.25
    gray_like = (sat < 0.25) & (val > 0.2) & (val < 0.9)
    infrastructure_mask = gray_like | edge_dense

    # Coverage ratios
    total = 256 * 256
    veg_ratio = float(vegetation_mask.sum()) / total
    water_ratio = float(water_sky_mask.sum()) / total
    infra_ratio = float(infrastructure_mask.sum()) / total

    found: List[str] = []
    predictions: List[Dict[str, float]] = []
    if veg_ratio >= 0.05:
        found.append("vegetation")
        predictions.append({"label": "vegetation", "score": round(veg_ratio, 4)})
    if water_ratio >= 0.04:
        found.append("water_sky")
        predictions.append({"label": "water_sky", "score": round(water_ratio, 4)})
    if infra_ratio >= 0.20:
        found.append("infrastructure")
        predictions.append({"label": "infrastructure", "score": round(infra_ratio, 4)})

    return {"categories": found, "predictions": predictions}


def _load_image(image_base64: str) -> Image.Image:
    try:
        data = base64.b64decode(image_base64)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 payload: {exc}")

    try:
        image = Image.open(BytesIO(data)).convert("RGB")
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=415, detail=f"Unsupported image format: {exc}")

    return image


def _calc_environment_score(image: Image.Image) -> HeuristicResult:
    arr = np.asarray(image).astype(np.float32) / 255.0
    if arr.size == 0:
        raise HTTPException(status_code=422, detail="Empty image payload")

    # Channel averages
    mean_channels = arr.mean(axis=(0, 1))
    red, green, blue = mean_channels

    total = float(red + green + blue) + 1e-6
    green_ratio = green / total
    blue_ratio = blue / total

    stat = ImageStat.Stat(image.convert("L"))
    texture_std = float(stat.stddev[0]) / 128.0  # Normalised 0-2 range
    texture_std = max(0.0, min(texture_std, 1.5))

    # Palette size as proxy for diversity
    palette = image.resize((64, 64)).quantize(colors=256, method=0)
    palette_size = len(palette.getcolors() or [])

    green_signal = 0.55 * green_ratio + 0.15 * blue_ratio
    texture_signal = 0.3 * (texture_std if not math.isnan(texture_std) else 0.0)
    diversity_signal = 0.15 * min(palette_size / 128.0, 1.0)

    environment_score = float(max(0.0, min(green_signal + texture_signal + diversity_signal, 1.0)))

    cues: List[str] = []
    if green_ratio > 0.34:
        cues.append("Vegetation dominant")
    if blue_ratio > 0.28:
        cues.append("Sky/Water signature")
    if texture_std > 0.35:
        cues.append("Natural texture variance")
    if palette_size < 48:
        cues.append("Limited palette (possible synthetic)")

    # AI suspicion heuristics
    ai_suspect = bool(
        (palette_size < 32 and texture_std < 0.25)
        or (green_ratio < 0.22 and blue_ratio < 0.22 and texture_std < 0.2)
    )

    return HeuristicResult(environment_score=environment_score, ai_suspect=ai_suspect, cues=cues)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze-image", tags=["analysis"])
def analyze_image(payload: AnalyzeImageRequest):
    image = _load_image(payload.image_base64)
    heuristics = _calc_environment_score(image)
    feature_detection = _detect_environmental_features(image)

    environment_score = heuristics.environment_score
    ai_suspect = heuristics.ai_suspect
    detected_categories = feature_detection.get("categories", [])
    top_predictions = feature_detection.get("predictions", [])

    feature_gate_passed = len(detected_categories) >= MIN_FEATURE_CATEGORIES

    # Run optional Places365 scene classifier to get a scene-level label.
    places_preds = _run_places_classifier(image)
    places_top = None
    if places_preds:
        places_top = places_preds[0]

    # If Places365 gives a strong indoor/non-environment prediction, prefer an immediate reject.
    if places_top:
        plabel = places_top.get("label", "").lower()
        pscore = float(places_top.get("score", 0.0))
        non_env_tokens = ["classroom", "indoor", "kitchen", "bedroom", "office", "studio", "auditorium", "hospital", "library"]
        env_tokens = ["forest", "park", "beach", "field", "mountain", "valley", "river", "lake", "ocean", "sea", "harbour", "garden", "meadow"]
        try:
            if any(tok in plabel for tok in non_env_tokens) and pscore > 0.6:
                decision = "reject_non_environment"
                label = "non_environment"
                confidence = round(pscore, 3)
                reason = f"Places365 scene '{places_top['label']}' indicates an indoor/non-environment scene."
                return {
                    "decision": decision,
                    "label": label,
                    "environment_score": round(environment_score, 3),
                    "is_ai_generated": ai_suspect,
                    "confidence": confidence,
                    "cues": heuristics.cues,
                    "reason": reason,
                    "detected_features": detected_categories,
                    "top_predictions": [{"label": pred["label"], "score": round(pred["score"], 4)} for pred in top_predictions],
                    "places_top": places_top,
                }
            # If places strongly indicates a natural scene, nudge heuristic score up slightly to avoid false negatives
            if any(tok in plabel for tok in env_tokens) and pscore > 0.45:
                environment_score = max(environment_score, 0.5)
        except Exception:
            # be defensive: if any unexpected shape in places_top, ignore it
            pass

    if not feature_gate_passed:
        if environment_score >= 0.55:
            decision = "needs_review"
            label = "uncertain"
            confidence = 0.6
            reason = (
                "General environmental cues detected, but not enough distinct feature "
                "categories (trees/roads/water/etc.)."
            )
        else:
            decision = "reject_non_environment"
            label = "non_environment"
            confidence = round(0.6 + (0.3 * (0.5 - environment_score)), 2)
            reason = "Image lacks required environmental feature categories."
    elif ai_suspect and environment_score < 0.55:
        decision = "reject_ai_generated"
        label = "ai_generated"
        confidence = 0.7
        reason = "Synthetic texture patterns detected with low environmental signature."
    elif environment_score < 0.42:
        decision = "reject_non_environment"
        label = "non_environment"
        confidence = round(0.65 + (0.35 * (0.42 - environment_score)), 2)
        reason = "Image lacks sufficient natural cues (vegetation/sky/water)."
    else:
        decision = "accept"
        label = "environment"
        confidence = round(0.75 + (environment_score * 0.2), 2)
        reason = "Natural context confirmed by colour diversity and texture cues."

        if ai_suspect:
            decision = "needs_review"
            reason = "Natural cues present, but synthetic texture patterns detected."

    return {
        "decision": decision,
        "label": label,
        "environment_score": round(environment_score, 3),
        "is_ai_generated": ai_suspect,
        "confidence": confidence,
        "cues": heuristics.cues,
        "reason": reason,
        "detected_features": detected_categories,
        "top_predictions": [{"label": pred["label"], "score": round(pred["score"], 4)} for pred in top_predictions],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=False)

