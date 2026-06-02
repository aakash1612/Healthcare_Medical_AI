"""
Python Inference Service
========================
FastAPI microservice that handles CNN inference + Grad-CAM heatmap generation.
Model-agnostic: the model_id in the request determines which weights to load.
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging

from models.model_loader import ModelLoader
from gradcam.gradcam_engine import GradCAMEngine
from schemas import InferenceResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Medical AI Inference Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singleton loader — keeps models cached in memory
model_loader = ModelLoader()
@app.on_event("startup")
async def startup():
    logger.info("Preloading xray-pneumonia-v1 model...")
    try:
        model_loader.get("xray-pneumonia-v1")
        logger.info("Model preloaded successfully")
    except Exception as e:
        logger.error(f"Failed to preload model: {e}")

@app.get("/health")
def health():
    return {"status": "ok", "loaded_models": list(model_loader.cache.keys())}


@app.post("/inference", response_model=InferenceResponse)
async def run_inference(
    image: UploadFile = File(...),
    model_id: str = Form(...),
):
    logger.info(f"Inference request: model_id={model_id}, file={image.filename}")

    # Load/cache model
    try:
        model, config = model_loader.get(model_id)
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Unknown model_id: {model_id}")

    # Read image bytes
    image_bytes = await image.read()

    # ── Stage 1: CNN Classification ────────────────────────────────────
    engine = GradCAMEngine(model, config)
    prediction = engine.predict(image_bytes)

    # ── Stage 2: Grad-CAM Heatmap ──────────────────────────────────────
    gradcam_result = engine.generate_gradcam(image_bytes, prediction["predicted_class"])

    return InferenceResponse(
        prediction={
            "predictedClass": prediction["predicted_class"],
            "confidence": prediction["confidence"],
            "classScores": prediction["class_scores"],
            "modelId": model_id,
        },
        gradcam={
            "heatmapBase64": gradcam_result["heatmap_b64"],
            "overlayBase64": gradcam_result["overlay_b64"],
            "topRegions": gradcam_result["top_regions"],
        },
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001)
