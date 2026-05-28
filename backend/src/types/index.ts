// ============================================================
// SHARED TYPES — used by backend, frontend, and Python bridge
// ============================================================

// ------ Model Registry (extensible for future models) ------

export type SupportedModality = 'xray' | 'ct_scan' | 'mri' | 'fundus_retina' | 'histopathology';

export interface ModelDefinition {
  id: string;                       // e.g. "xray-pneumonia-v1"
  name: string;                     // Human-readable
  modality: SupportedModality;
  version: string;
  classes: string[];                // e.g. ["Normal", "Pneumonia"]
  description: string;
  gradcamEnabled: boolean;
  isActive: boolean;
}

// ------ Analysis Pipeline ------

export interface AnalysisRequest {
  sessionId: string;
  modelId: string;
  imageBase64?: string;
  imageUrl?: string;
}

export type AnalysisStatus =
  | 'queued'
  | 'preprocessing'
  | 'running_cnn'
  | 'generating_heatmap'
  | 'retrieving_knowledge'
  | 'generating_report'
  | 'complete'
  | 'error';

export interface CNNPrediction {
  predictedClass: string;
  confidence: number;               // 0–1
  classScores: Record<string, number>;
  modelId: string;
}

export interface GradCAMResult {
  heatmapBase64: string;            // PNG overlay
  overlayBase64: string;            // Original + heatmap blended
  topRegions: HeatmapRegion[];
}

export interface HeatmapRegion {
  label: string;                    // e.g. "Upper right lobe opacity"
  intensity: number;                // 0–1
  boundingBox: { x: number; y: number; w: number; h: number };
}

export interface RAGChunk {
  id: string;
  text: string;
  source: string;                   // e.g. "Harrison's Principles, Ch. 12"
  relevanceScore: number;
}

export interface AnalysisReport {
  summary: string;                  // LLM-generated natural language
  findings: string[];
  recommendations: string[];
  differentialDiagnosis: string[];
  confidenceNarrative: string;
  disclaimer: string;
  retrievedSources: RAGChunk[];
}

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

// ------ WebSocket Events ------

export type SocketEvent =
  | 'analysis:progress'
  | 'analysis:complete'
  | 'analysis:error'
  | 'chat:message'
  | 'chat:response'
  | 'chat:thinking';

export interface ProgressPayload {
  sessionId: string;
  status: AnalysisStatus;
  message: string;
  percentComplete: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RAGChunk[];
  timestamp: string;
}

// ------ API Response Wrappers ------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
