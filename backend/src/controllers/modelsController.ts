import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { getAllModels, getActiveModels, getModelById } from '../models/modelRegistry';
import { ApiResponse, ModelDefinition } from '../types';

export const listModels = asyncHandler(async (_req: Request, res: Response) => {
  const models = getAllModels();
  res.json({ success: true, data: models } satisfies ApiResponse<ModelDefinition[]>);
});

export const listActiveModels = asyncHandler(async (_req: Request, res: Response) => {
  const models = getActiveModels();
  res.json({ success: true, data: models } satisfies ApiResponse<ModelDefinition[]>);
});

export const getModel = asyncHandler(async (req: Request, res: Response) => {
  const { modelId } = req.params;
  const model = getModelById(modelId);

  if (!model) {
    res.status(404).json({ success: false, error: `Model not found: ${modelId}` } satisfies ApiResponse<null>);
    return;
  }

  res.json({ success: true, data: model } satisfies ApiResponse<ModelDefinition>);
});
