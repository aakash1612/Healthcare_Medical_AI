import mongoose, { Document, Schema } from 'mongoose';
import { AnalysisStatus } from '../types';

export interface IAnalysisSession extends Document {
  sessionId: string;
  modelId: string;
  originalImagePath: string;
  status: AnalysisStatus;
  prediction?: {
    predictedClass: string;
    confidence: number;
    classScores: Record<string, number>;
  };
  gradcamHeatmapPath?: string;
  gradcamOverlayPath?: string;
  report?: {
    summary: string;
    findings: string[];
    recommendations: string[];
    differentialDiagnosis: string[];
    confidenceNarrative: string;
    disclaimer: string;
  };
  chatHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  processingTimeMs?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnalysisSessionSchema = new Schema<IAnalysisSession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    modelId: { type: String, required: true },
    originalImagePath: { type: String, required: true },
    status: {
      type: String,
      enum: [
        'queued', 'preprocessing', 'running_cnn', 'generating_heatmap',
        'retrieving_knowledge', 'generating_report', 'complete', 'error',
      ],
      default: 'queued',
    },
    prediction: {
      predictedClass: String,
      confidence: Number,
      classScores: { type: Map, of: Number },
    },
    gradcamHeatmapPath: String,
    gradcamOverlayPath: String,
    report: {
      summary: String,
      findings: [String],
      recommendations: [String],
      differentialDiagnosis: [String],
      confidenceNarrative: String,
      disclaimer: String,
    },
    chatHistory: [
      {
        role: { type: String, enum: ['user', 'assistant'] },
        content: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    processingTimeMs: Number,
    error: String,
  },
  { timestamps: true }
);

export const AnalysisSession = mongoose.model<IAnalysisSession>(
  'AnalysisSession',
  AnalysisSessionSchema
);
