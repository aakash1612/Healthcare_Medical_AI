import { ModelDefinition, SupportedModality } from '../types';

/**
 * MODEL REGISTRY
 * --------------
 * Add new models here without touching any other backend code.
 * Each model entry drives the Python inference service, RAG queries,
 * and the frontend model selector automatically.
 */
const MODEL_REGISTRY: ModelDefinition[] = [
  // ── Stage 1: X-Ray Models ──────────────────────────────────────────
  {
    id: 'xray-pneumonia-v1',
    name: 'Chest X-Ray — Pneumonia Detector',
    modality: 'xray',
    version: '1.0.0',
    classes: ['Normal', 'Pneumonia'],
    description:
      'ResNet-50 trained on the Kaggle Chest X-Ray dataset (5,863 images). ' +
      'Distinguishes bacterial/viral pneumonia from normal lung tissue.',
    gradcamEnabled: true,
    isActive: true,
  },

  // ── Stage 2 (Future): Retinal / Fundus Models ─────────────────────
  {
    id: 'fundus-retinopathy-v1',
    name: 'Fundus — Diabetic Retinopathy Grader',
    modality: 'fundus_retina',
    version: '0.1.0',           // Not yet trained — placeholder
    classes: ['No DR', 'Mild', 'Moderate', 'Severe', 'Proliferative DR'],
    description:
      'EfficientNet-B4 for grading Diabetic Retinopathy severity (0–4) ' +
      'from fundus photographs.',
    gradcamEnabled: true,
    isActive: false,             // Set true when model weights are ready
  },

  // ── Stage 3 (Future): Histopathology ──────────────────────────────
  {
    id: 'histo-cancer-v1',
    name: 'Histopathology — Breast Cancer Classifier',
    modality: 'histopathology',
    version: '0.1.0',
    classes: ['Benign', 'Malignant'],
    description:
      'DenseNet-121 for binary classification of invasive ductal carcinoma ' +
      'from H&E-stained histopathology patches.',
    gradcamEnabled: true,
    isActive: false,
  },
];

// ── Registry API ──────────────────────────────────────────────────────

export function getAllModels(): ModelDefinition[] {
  return MODEL_REGISTRY;
}

export function getActiveModels(): ModelDefinition[] {
  return MODEL_REGISTRY.filter((m) => m.isActive);
}

export function getModelById(id: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export function getModelsByModality(modality: SupportedModality): ModelDefinition[] {
  return MODEL_REGISTRY.filter((m) => m.modality === modality && m.isActive);
}
