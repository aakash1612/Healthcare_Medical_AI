from pydantic import BaseModel
from typing import Dict, List, Any


class BoundingBox(BaseModel):
    x: float
    y: float
    w: float
    h: float


class HeatmapRegion(BaseModel):
    label: str
    intensity: float
    boundingBox: BoundingBox


class PredictionOutput(BaseModel):
    predictedClass: str
    confidence: float
    classScores: Dict[str, float]
    modelId: str


class GradCAMOutput(BaseModel):
    heatmapBase64: str
    overlayBase64: str
    topRegions: List[HeatmapRegion]


class InferenceResponse(BaseModel):
    prediction: PredictionOutput
    gradcam: GradCAMOutput
