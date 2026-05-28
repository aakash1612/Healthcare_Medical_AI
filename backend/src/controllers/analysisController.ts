import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; 
import { runAnalysisPipeline } from '../services/analysisService';
import { answerFollowUp } from '../services/llmService';
import { getModelById } from '../models/modelRegistry';
import { AnalysisSession } from '../models/AnalysisSession';
import { ApiResponse, AnalysisResult, ChatMessage } from '../types';
import { logger } from '../utils/logger';

/**
 * POST /api/analysis/upload
 * Upload an image and kick off the 3-stage pipeline asynchronously.
 */
export const uploadAndAnalyze = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  const modelId = req.body.modelId as string;

  if (!file) {
    res.status(400).json({ success: false, error: 'No image file provided' });
    return;
  }

  const modelDef = getModelById(modelId);
  if (!modelDef) {
    res.status(400).json({ success: false, error: `Unknown model ID: ${modelId}` });
    return;
  }
  if (!modelDef.isActive) {
    res.status(400).json({ success: false, error: `Model "${modelDef.name}" is not yet active` });
    return;
  }

  const imagePath = path.join(process.env.UPLOAD_DIR || './uploads', file.filename);
  
  // 🌟 Pre-generate the unique tracking ID safely now
  const generatedSessionId = uuidv4();
  
  logger.info(`[Controller] Starting analysis [Session: ${generatedSessionId}] — model=${modelId}, file=${file.filename}`);

  // ✅ FIXED: Safely calling the function from your service layer here
  runAnalysisPipeline(imagePath, modelId, generatedSessionId).catch((err) =>
    logger.error('[Controller] Pipeline error (async):', err)
  );

  // Return the sessionId to the client immediately in the response data object
  res.status(202).json({
    success: true,
    message: 'Analysis started successfully.',
    data: { 
      modelId, 
      fileName: file.filename,
      sessionId: generatedSessionId // Frontend catches this and links the socket room instantly!
    },
  });
});

/**
 * GET /api/analysis/:sessionId
 * Retrieve a completed analysis session.
 */
export const getAnalysis = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = await AnalysisSession.findOne({ sessionId });

  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' } satisfies ApiResponse<null>);
    return;
  }

  res.json({ success: true, data: session } satisfies ApiResponse<typeof session>);
});

/**
 * POST /api/analysis/:sessionId/chat
 * Ask a follow-up question about a scan.
 */
export const chatAboutScan = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { question } = req.body as { question: string };

  if (!question?.trim()) {
    res.status(400).json({ success: false, error: 'question is required' } satisfies ApiResponse<null>);
    return;
  }

  const session = await AnalysisSession.findOne({ sessionId });
  if (!session || session.status !== 'complete') {
    res.status(404).json({ success: false, error: 'Analysis session not found or incomplete' } satisfies ApiResponse<null>);
    return;
  }

  const modelDef = getModelById(session.modelId)!;

  // Re-hydrate context
  const analysisContext = {
    prediction: session.prediction as AnalysisResult['prediction'],
    report: { ...session.report, retrievedSources: [] } as AnalysisResult['report'],
    modelDef,
  };

  const chatHistory = session.chatHistory.map<ChatMessage>((m) => ({
    id: '',
    sessionId,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
  }));

  const { answer, sources } = await answerFollowUp(question, analysisContext, chatHistory);

  // Persist to chat history
  await session.updateOne({
    $push: {
      chatHistory: [
        { role: 'user', content: question, timestamp: new Date() },
        { role: 'assistant', content: answer, timestamp: new Date() },
      ],
    },
  });

  res.json({
    success: true,
    data: { answer, sources, sessionId },
  } satisfies ApiResponse<{ answer: string; sources: typeof sources; sessionId: string }>);
});

/**
 * GET /api/analysis/history
 * List recent analysis sessions (for dashboard).
 */
export const getHistory = asyncHandler(async (_req: Request, res: Response) => {
  const sessions = await AnalysisSession.find()
    .sort({ createdAt: -1 })
    .limit(20)
    .select('sessionId modelId status prediction.predictedClass prediction.confidence createdAt processingTimeMs');

  res.json({ success: true, data: sessions } satisfies ApiResponse<typeof sessions>);
});