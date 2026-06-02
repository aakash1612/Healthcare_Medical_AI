import axios from 'axios';
import { ModelDefinition, AnalysisResult, ApiResponse } from '../types';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}/api`,
  timeout: 180_000,
});

export const modelsApi = {
  getAll: () => api.get<ApiResponse<ModelDefinition[]>>('/models').then(r => r.data),
  getActive: () => api.get<ApiResponse<ModelDefinition[]>>('/models/active').then(r => r.data),
};

export const analysisApi = {
  upload: (file: File, modelId: string, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append('image', file);
    form.append('modelId', modelId);
    return api.post<ApiResponse<{ modelId: string; fileName: string }>>(
      '/analysis/upload',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
      }
    ).then(r => r.data);
  },

  get: (sessionId: string) =>
    api.get<ApiResponse<AnalysisResult>>(`/analysis/${sessionId}`).then(r => r.data),

  history: () =>
    api.get<ApiResponse<AnalysisResult[]>>('/analysis/history').then(r => r.data),

  chat: (sessionId: string, question: string) =>
    api.post<ApiResponse<{ answer: string; sources: unknown[] }>>(
      `/analysis/${sessionId}/chat`,
      { question }
    ).then(r => r.data),
};
