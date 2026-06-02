"""
Model Loader
============
Loads CNN weights from disk and caches them.
Adding a new model = add an entry to MODEL_CONFIGS dict.
"""

import os
import logging
from typing import Tuple, Dict, Any
import torch
import torch.nn as nn
from torchvision import models, transforms

logger = logging.getLogger(__name__)

# ── Model Configurations ─────────────────────────────────────────────────────
# Each entry maps a model_id to its architecture, weights path, and class list.
# This mirrors the TypeScript modelRegistry on the backend.

MODEL_CONFIGS: Dict[str, Dict[str, Any]] = {
    "xray-pneumonia-v1": {
        "architecture": "resnet50",
        "weights_path": os.path.join(os.path.dirname(__file__), "weights", "xray_pneumonia_resnet50.pth"),
        "classes": ["Normal", "Pneumonia"],
        "input_size": 224,
        "gradcam_layer": "layer4",   # Last conv layer in ResNet50
        "normalize_mean": [0.485, 0.456, 0.406],
        "normalize_std": [0.229, 0.224, 0.225],
    },
    # ── Future models — add weights_path when ready ─────────────────────
    "fundus-retinopathy-v1": {
        "architecture": "efficientnet_b4",
        "weights_path": os.path.join(os.path.dirname(__file__), "weights", "fundus_retinopathy_effnet.pth"),
        "classes": ["No DR", "Mild", "Moderate", "Severe", "Proliferative DR"],
        "input_size": 380,
        "gradcam_layer": "features",
        "normalize_mean": [0.485, 0.456, 0.406],
        "normalize_std": [0.229, 0.224, 0.225],
    },
    "histo-cancer-v1": {
        "architecture": "densenet121",
        "weights_path": os.path.join(os.path.dirname(__file__), "weights", "histo_cancer_densenet.pth"),
        "classes": ["Benign", "Malignant"],
        "input_size": 224,
        "gradcam_layer": "features",
        "normalize_mean": [0.485, 0.456, 0.406],
        "normalize_std": [0.229, 0.224, 0.225],
    },
}

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {DEVICE}")


def _build_model(architecture: str, num_classes: int) -> nn.Module:
    """Instantiate a pretrained backbone and replace the classifier head."""
    if architecture == "resnet50":
        model = models.resnet50(weights=None)
        model.fc = nn.Linear(model.fc.in_features, num_classes)

    elif architecture == "efficientnet_b4":
        model = models.efficientnet_b4(weights=None)
        in_features = model.classifier[1].in_features
        model.classifier[1] = nn.Linear(in_features, num_classes)

    elif architecture == "densenet121":
        model = models.densenet121(weights=None)
        model.classifier = nn.Linear(model.classifier.in_features, num_classes)

    else:
        raise ValueError(f"Unsupported architecture: {architecture}")

    return model.to(DEVICE)


class ModelLoader:
    """Loads and caches model instances. Thread-safe for single-process FastAPI."""

    def __init__(self):
        self.cache: Dict[str, Tuple[nn.Module, Dict[str, Any]]] = {}

    def get(self, model_id: str) -> Tuple[nn.Module, Dict[str, Any]]:
        if model_id not in MODEL_CONFIGS:
            raise KeyError(f"No config for model_id: {model_id}")

        if model_id not in self.cache:
            self.cache[model_id] = self._load(model_id)

        return self.cache[model_id]

    def _load(self, model_id: str) -> Tuple[nn.Module, Dict[str, Any]]:
        config = MODEL_CONFIGS[model_id]
        num_classes = len(config["classes"])

        logger.info(f"Loading model: {model_id} ({config['architecture']}, {num_classes} classes)")
        model = _build_model(config["architecture"], num_classes)

        weights_path = config["weights_path"]
        if os.path.exists(weights_path):
            state_dict = torch.load(weights_path, map_location=DEVICE)
            model.load_state_dict(state_dict)
            logger.info(f"Loaded weights from {weights_path}")
        else:
            logger.warning(
                f"Weights not found at {weights_path}. "
                "Running with random weights (for development only)."
            )

        model.eval()
        return model, config
