"""
Grad-CAM Engine
===============
Implements Gradient-weighted Class Activation Mapping.

For any model + target layer, Grad-CAM:
  1. Does a forward pass and captures the target feature map activations.
  2. Does a backward pass for the target class to get gradients w.r.t. those activations.
  3. Global-average-pools the gradients to get per-channel weights.
  4. Produces a weighted sum of the feature maps → heatmap.
  5. Overlays the heatmap on the original image for visualization.
"""

import io
import base64
import logging
from typing import Dict, Any, List, Tuple

import cv2
import numpy as np
from PIL import Image
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms

logger = logging.getLogger(__name__)


def _preprocess(
    image_bytes: bytes,
    input_size: int,
    mean: List[float],
    std: List[float],
) -> Tuple[torch.Tensor, np.ndarray]:
    """Returns (model_input_tensor, original_rgb_array)."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    original_np = np.array(img)

    transform = transforms.Compose([
        transforms.Resize((input_size, input_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=mean, std=std),
    ])
    tensor = transform(img).unsqueeze(0)  # (1, C, H, W)
    return tensor, original_np


def _tensor_to_b64(arr: np.ndarray) -> str:
    """Converts an HxWxC uint8 numpy array to a base64-encoded PNG string."""
    _, buffer = cv2.imencode(".png", cv2.cvtColor(arr, cv2.COLOR_RGB2BGR))
    return base64.b64encode(buffer).decode("utf-8")


def _extract_top_regions(cam: np.ndarray, threshold: float = 0.5) -> List[Dict]:
    """Finds bounding boxes of high-activation regions in the CAM."""
    binary = (cam > threshold).astype(np.uint8) * 255
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    regions = []
    for i, cnt in enumerate(sorted(contours, key=cv2.contourArea, reverse=True)[:3]):
        x, y, w, h = cv2.boundingRect(cnt)
        roi_intensity = float(cam[y:y+h, x:x+w].mean())
        regions.append({
            "label": f"Region {i+1} — high activation area",
            "intensity": round(roi_intensity, 3),
            "boundingBox": {
                "x": round(x / cam.shape[1], 3),
                "y": round(y / cam.shape[0], 3),
                "w": round(w / cam.shape[1], 3),
                "h": round(h / cam.shape[0], 3),
            },
        })
    return regions


class GradCAMEngine:
    def __init__(self, model: nn.Module, config: Dict[str, Any]):
        self.model = model
        self.config = config
        self.device = next(model.parameters()).device

        self._activations: torch.Tensor | None = None
        self._gradients: torch.Tensor | None = None
        self._hook_handles = []

    def _register_hooks(self, layer: nn.Module):
        def forward_hook(_, __, output):
            self._activations = output.detach()

        def backward_hook(_, __, grad_output):
            self._gradients = grad_output[0].detach()

        self._hook_handles.append(layer.register_forward_hook(forward_hook))
        self._hook_handles.append(layer.register_full_backward_hook(backward_hook))

    def _remove_hooks(self):
        for h in self._hook_handles:
            h.remove()
        self._hook_handles.clear()

    def _get_target_layer(self) -> nn.Module:
        layer_name = self.config["gradcam_layer"]
        return dict(self.model.named_modules())[layer_name]

    def predict(self, image_bytes: bytes) -> Dict[str, Any]:
        tensor, _ = _preprocess(
            image_bytes,
            self.config["input_size"],
            self.config["normalize_mean"],
            self.config["normalize_std"],
        )
        tensor = tensor.to(self.device)

        with torch.no_grad():
            logits = self.model(tensor)
            probs = F.softmax(logits, dim=1).squeeze(0)

        classes = self.config["classes"]
        predicted_idx = int(probs.argmax().item())
        confidence = float(probs[predicted_idx].item())
        class_scores = {cls: round(float(probs[i].item()), 4) for i, cls in enumerate(classes)}

        return {
            "predicted_class": classes[predicted_idx],
            "confidence": round(confidence, 4),
            "class_scores": class_scores,
        }

def generate_gradcam(self, image_bytes: bytes, target_class: str) -> Dict[str, Any]:
    logger.info("GradCAM Step 1: preprocessing image")

    tensor, original_np = _preprocess(
        image_bytes,
        self.config["input_size"],
        self.config["normalize_mean"],
        self.config["normalize_std"],
    )

    tensor = tensor.to(self.device).requires_grad_(True)

    target_layer = self._get_target_layer()
    self._register_hooks(target_layer)

    try:
        logger.info("GradCAM Step 2: starting forward pass")

        logits = self.model(tensor)

        logger.info("GradCAM Step 3: forward pass completed")

        classes = self.config["classes"]
        target_idx = classes.index(target_class)

        logger.info("GradCAM Step 4: starting backward pass")

        self.model.zero_grad()
        logits[0, target_idx].backward()

        logger.info("GradCAM Step 5: backward pass completed")

        activations = self._activations
        gradients = self._gradients

        if activations is None or gradients is None:
            raise RuntimeError("Hooks did not capture activations/gradients")

        weights = gradients.mean(dim=(2, 3), keepdim=True)
        cam = F.relu((weights * activations).sum(dim=1)).squeeze(0)

        logger.info("GradCAM Step 6: CAM generated")

        cam = cam.cpu().numpy()
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

        original_h, original_w = original_np.shape[:2]

        logger.info(
            f"Original image dimensions: {original_w}x{original_h}"
        )

        # Limit output size for Render Free memory constraints
        MAX_SIZE = 1024

        scale = min(MAX_SIZE / max(original_h, original_w), 1.0)

        new_w = int(original_w * scale)
        new_h = int(original_h * scale)

        logger.info(
            f"Resized dimensions for GradCAM: {new_w}x{new_h}"
        )

        original_np = cv2.resize(original_np, (new_w, new_h))

        cam_resized = cv2.resize(cam, (new_w, new_h))

        logger.info("GradCAM Step 7: creating heatmap")

        heatmap = cv2.applyColorMap(
            np.uint8(255 * cam_resized),
            cv2.COLORMAP_JET
        )

        heatmap_rgb = cv2.cvtColor(
            heatmap,
            cv2.COLOR_BGR2RGB
        )

        logger.info("GradCAM Step 8: heatmap created")

        overlay = cv2.addWeighted(
            original_np,
            0.6,
            heatmap_rgb,
            0.4,
            0
        )

        logger.info("GradCAM Step 9: overlay created")

        top_regions = _extract_top_regions(cam_resized)

        logger.info("GradCAM Step 10: encoding images")

        result = {
            "heatmap_b64": _tensor_to_b64(heatmap_rgb),
            "overlay_b64": _tensor_to_b64(overlay),
            "top_regions": top_regions,
        }

        logger.info("GradCAM Step 11: completed successfully")

        return result

    finally:
        self._remove_hooks()
