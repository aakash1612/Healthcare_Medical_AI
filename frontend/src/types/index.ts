// Mirror of backend/src/types/index.ts — keep in sync

export type SupportedModality = 'xray' | 'ct_scan' | 'mri' | 'fundus_retina' | 'histopathology';

export interface ModelDefinition {
  id: string;
  name: string;
  modality: SupportedModality;
  version: string;
  classes: string[];
  description: string;
  gradcamEnabled: boolean;
  isActive: boolean;
}

export interface CNNPrediction {
  predictedClass: string;
  confidence: number;
  classScores: Record<string, number>;
  modelId: string;
}

export interface HeatmapRegion {
  label: string;
  intensity: number;
  boundingBox: { x: number; y: number; w: number; h: number };
}

export interface GradCAMResult {
  heatmapBase64: string;
  overlayBase64: string;
  topRegions: HeatmapRegion[];
}

export interface RAGChunk {
  id: string;
  text: string;
  source: string;
  relevanceScore: number;
}

export interface AnalysisReport {
  summary: string;
  findings: string[];
  recommendations: string[];
  differentialDiagnosis: string[];
  confidenceNarrative: string;
  disclaimer: string;
  retrievedSources: RAGChunk[];
}

export type AnalysisStatus =
  | 'queued' | 'preprocessing' | 'running_cnn' | 'generating_heatmap'
  | 'retrieving_knowledge' | 'generating_report' | 'complete' | 'error';

export interface AnalysisResult {
  sessionId: string;
  status: AnalysisStatus;
  modelUsed: ModelDefinition;
  originalImageUrl: string;
  prediction: CNNPrediction;
  gradcam: GradCAMResult;
  report: AnalysisReport;
  processingTimeMs: number;
  createdAt: string;
}

export interface ProgressPayload {
  sessionId: string;
  status: AnalysisStatus;
  message: string;
  percentComplete: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RAGChunk[];
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
