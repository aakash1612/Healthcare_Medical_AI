import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { Server as SocketServer } from 'socket.io';
import { runInference } from './pythonBridge';
import { retrieveMedicalKnowledge } from './ragService';
import { generateReport } from './llmService';
import { getModelById } from '../models/modelRegistry';
import { AnalysisSession } from '../models/AnalysisSession';
import { AnalysisResult, AnalysisStatus, ProgressPayload } from '../types';
import { logger } from '../utils/logger';

// Socket.io instance — injected at app startup
let io: SocketServer;
export function setSocketIO(socketIO: SocketServer) { io = socketIO; }

function emitProgress(sessionId: string, status: AnalysisStatus, message: string, pct: number) {
  const payload: ProgressPayload = { sessionId, status, message, percentComplete: pct };
  io?.to(sessionId).emit('analysis:progress', payload);
  logger.info(`[Analysis] ${sessionId} → ${status} (${pct}%) — ${message}`);
}

/**
 * Full 3-stage pipeline:
 * 1. CNN + Grad-CAM  (Python service)
 * 2. RAG retrieval   (ChromaDB)
 * 3. LLM report      (Gemini/OpenAI)
 */
export async function runAnalysisPipeline(
  imagePath: string,
  modelId: string,
  sessionId: string // ✅ Passed dynamically from our controller layer
): Promise<AnalysisResult> {
  // 🌟 FIXED: Removed const sessionId = uuidv4(); to prevent parameter shadowing
  const startTime = Date.now();

  const modelDef = getModelById(modelId);
  if (!modelDef) throw new Error(`Unknown model: ${modelId}`);
  if (!modelDef.isActive) throw new Error(`Model ${modelId} is not yet active`);

  // Create DB session using our synchronized tracking key
  const session = await AnalysisSession.create({
    sessionId,
    modelId,
    originalImagePath: imagePath,
    status: 'queued',
  });

  try {
    // ─── STAGE 1: CNN + Grad-CAM ───────────────────────────────────────
    emitProgress(sessionId, 'running_cnn', 'Running CNN classification…', 10);
    await session.updateOne({ status: 'running_cnn' });

    emitProgress(sessionId, 'generating_heatmap', 'Generating Grad-CAM heatmap…', 35);
    const { prediction, gradcam } = await runInference(imagePath, modelId);

    await session.updateOne({
      status: 'retrieving_knowledge',
      prediction: {
        predictedClass: prediction.predictedClass,
        confidence: prediction.confidence,
        classScores: prediction.classScores,
      },
    });

    // ─── STAGE 2: RAG ─────────────────────────────────────────────────
    emitProgress(sessionId, 'retrieving_knowledge', `Retrieving medical literature for "${prediction.predictedClass}"…`, 55);
    const ragChunks = await retrieveMedicalKnowledge(
      prediction.predictedClass,
      modelDef.modality,
      5
    );

    // ─── STAGE 3: LLM Report ──────────────────────────────────────────
    emitProgress(sessionId, 'generating_report', 'Generating clinical report…', 75);
    await session.updateOne({ status: 'generating_report' });

    const report = await generateReport(prediction, ragChunks, modelDef);

    const processingTimeMs = Date.now() - startTime;

    await session.updateOne({
      status: 'complete',
      gradcamHeatmapPath: gradcam.heatmapBase64,
      gradcamOverlayPath: gradcam.overlayBase64,
      report: {
        summary: report.summary,
        findings: report.findings,
        recommendations: report.recommendations,
        differentialDiagnosis: report.differentialDiagnosis,
        confidenceNarrative: report.confidenceNarrative,
        disclaimer: report.disclaimer,
      },
      processingTimeMs,
    });

    const result: AnalysisResult = {
      sessionId,
      status: 'complete',
      modelUsed: modelDef,
      originalImageUrl: `/uploads/${path.basename(imagePath)}`,
      prediction,
      gradcam,
      report,
      processingTimeMs,
      createdAt: new Date().toISOString(),
    };

    emitProgress(sessionId, 'complete', 'Analysis complete!', 100);
    io?.to(sessionId).emit('analysis:complete', result);

    logger.info(`[Analysis] ${sessionId} completed in ${processingTimeMs}ms`);
    return result;

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Analysis] ${sessionId} failed: ${message}`);
    await session.updateOne({ status: 'error', error: message });
    io?.to(sessionId).emit('analysis:error', { sessionId, error: message });
    throw error;
  }
}