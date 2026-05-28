import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { CNNPrediction, GradCAMResult } from '../types';
import { logger } from '../utils/logger';

const PYTHON_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

export interface InferenceResponse {
  prediction: CNNPrediction;
  gradcam: GradCAMResult;
}

/**
 * Sends an image to the Python CNN+GradCAM service.
 * The Python service is model-agnostic — we tell it which model to load.
 */
export async function runInference(
  imagePath: string,
  modelId: string
): Promise<InferenceResponse> {
  logger.info(`[PythonBridge] Running inference: model=${modelId}, image=${imagePath}`);

  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));
  form.append('model_id', modelId);

  try {
    const response = await axios.post<InferenceResponse>(
      `${PYTHON_URL}/inference`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 60_000, // CNN can take a moment
      }
    );
    return response.data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[PythonBridge] Inference failed: ${message}`);
    throw new Error(`Python inference service error: ${message}`);
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await axios.get(`${PYTHON_URL}/health`, { timeout: 5000 });
    return res.data?.status === 'ok';
  } catch {
    return false;
  }
}
