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
from torchvision import models

logger = logging.getLogger(__name__)

# ── Model Configurations ─────────────────────────────────────────────────────

MODEL_CONFIGS: Dict[str, Dict[str, Any]] = {
    "xray-pneumonia-v1": {
        "architecture": "resnet50",
        "weights_path": os.path.join(
            os.path.dirname(__file__),
            "weights",
            "xray_pneumonia_resnet50.pth"
        ),
        "classes": ["Normal", "Pneumonia"],
        "input_size": 224,
        "gradcam_layer": "layer4",
        "normalize_mean": [0.485, 0.456, 0.406],
        "normalize_std": [0.229, 0.224, 0.225],
    },
    "fundus-retinopathy-v1": {
        "architecture": "efficientnet_b4",
        "weights_path": os.path.join(
            os.path.dirname(__file__),
            "weights",
            "fundus_retinopathy_effnet.pth"
        ),
        "classes": [
            "No DR",
            "Mild",
            "Moderate",
            "Severe",
            "Proliferative DR"
        ],
        "input_size": 380,
        "gradcam_layer": "features",
        "normalize_mean": [0.485, 0.456, 0.406],
        "normalize_std": [0.229, 0.224, 0.225],
    },
    "histo-cancer-v1": {
        "architecture": "densenet121",
        "weights_path": os.path.join(
            os.path.dirname(__file__),
            "weights",
            "histo_cancer_densenet.pth"
        ),
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
    """Instantiate a backbone and replace the classifier head."""

    if architecture == "resnet50":
        model = models.resnet50(weights=None)
        model.fc = nn.Linear(model.fc.in_features, num_classes)

    elif architecture == "efficientnet_b4":
        model = models.efficientnet_b4(weights=None)
        in_features = model.classifier[1].in_features
        model.classifier[1] = nn.Linear(in_features, num_classes)

    elif architecture == "densenet121":
        model = models.densenet121(weights=None)
        model.classifier = nn.Linear(
            model.classifier.in_features,
            num_classes
        )

    else:
        raise ValueError(f"Unsupported architecture: {architecture}")

    return model.to(DEVICE)


class ModelLoader:
    """Loads and caches model instances."""

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

        logger.info(
            f"Loading model: {model_id} "
            f"({config['architecture']}, {num_classes} classes)"
        )

        weights_path = config["weights_path"]

        logger.info(f"Weights path: {weights_path}")
        logger.info(f"Weights exist: {os.path.exists(weights_path)}")

        if False and os.path.exists(weights_path):
            size_mb = os.path.getsize(weights_path) / (1024 * 1024)
            logger.info(f"Checkpoint size: {size_mb:.2f} MB")

        logger.info("Building model architecture...")
        model = _build_model(config["architecture"], num_classes)
        logger.info("Model architecture built successfully")

        if os.path.exists(weights_path):
            try:
                logger.info("Starting torch.load()")

                state_dict = torch.load(
                    weights_path,
                    map_location="cpu"
                )

                logger.info("torch.load() completed")

                logger.info("Loading state_dict into model")
                model.load_state_dict(state_dict)

                logger.info("state_dict loaded successfully")

            except Exception as e:
                logger.exception(f"Error loading weights: {e}")
                raise

        else:
            logger.warning(
                f"Weights not found at {weights_path}. "
                "Running with random weights."
            )

        model.eval()

        logger.info("Model ready for inference")

        return model, config