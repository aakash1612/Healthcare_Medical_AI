import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk'; // ✅ Added Groq SDK import
import {
  CNNPrediction,
  AnalysisReport,
  RAGChunk,
  ChatMessage,
  ModelDefinition
} from '../types';
import { logger } from '../utils/logger';

// ── 🛠️ INITIALIZE BOTH ENDPOINTS ───────────────────────────────────────

// 1. Initialize Gemini SDK (For strict structured JSON clinical report generation)
const genAI = new GoogleGenerativeAI(process.env.Gemini_API_KEY || '');
const MODEL_NAME = process.env.LLM_MODEL || 'gemini-1.5-flash';

const geminiJsonModel = genAI.getGenerativeModel({
  model: MODEL_NAME,
  generationConfig: { responseMimeType: "application/json" }
});

// 2. Initialize Groq SDK (For blazing-fast chat follow-ups without 503 limits)
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ── 📄 STAGE 3: STRUCTURAL MEDICAL REPORT GENERATION (GEMINI) ──────────
/**
 * Generates structured medical report using CNN output + RAG context
 */
export async function generateReport(
  prediction: CNNPrediction,
  ragChunks: RAGChunk[],
  modelDef: ModelDefinition,
  imageDescription?: string
): Promise<AnalysisReport> {

  const ragContext = ragChunks
    .map((c, i) => `[${i + 1}] Source: ${c.source}\n${c.text}`)
    .join('\n\n');

  const prompt = `
You are an expert radiologist AI assistant.
You analyze medical imaging results and generate evidence-based structured clinical reports.
ONLY use information from the provided medical literature context.
Always include uncertainty and explicitly state that this is an AI-assisted analysis requiring physician review.

-----------------------------------
MODEL:
${modelDef.name}

MODALITY:
${modelDef.modality}

PREDICTION:
${prediction.predictedClass}

CONFIDENCE:
${(prediction.confidence * 100).toFixed(1)}%

CLASS SCORES:
${JSON.stringify(prediction.classScores, null, 2)}

-----------------------------------
MEDICAL KNOWLEDGE:
${ragContext}

-----------------------------------
Return a valid JSON object matching this exact schema structural definition:
{
  "summary": "2-3 sentence plain English summary of findings",
  "findings": ["finding 1", "finding 2"],
  "recommendations": ["recommendation 1"],
  "differentialDiagnosis": ["diagnosis 1"],
  "confidenceNarrative": "confidence explanation",
  "disclaimer": "medical disclaimer"
}
`;

  logger.info(`[LLM] Generating Gemini (${MODEL_NAME}) report for ${prediction.predictedClass}`);

  try {
    const result = await geminiJsonModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const cleaned = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      ...parsed,
      retrievedSources: ragChunks,
      disclaimer: parsed.disclaimer || 'This AI-generated analysis must be reviewed by a qualified medical professional.'
    } as AnalysisReport;
  } catch (error) {
    logger.error(`[LLM Error] Generation failed: ${error}`);
    throw error;
  }
}

// ── 💬 CLINICAL CHAT INTERACTION (GROQ BYPASS) ─────────────────────────
/**
 * Follow-up medical chat interaction routed securely through Groq
 */
export async function answerFollowUp(
  question: string,
  analysisContext: {
    prediction: CNNPrediction;
    report: AnalysisReport;
    modelDef: ModelDefinition;
    gradcam?: { heatmapBase64: string; overlayBase64: string }; // Extended support
  },
  chatHistory: ChatMessage[]
): Promise<{ answer: string; sources: RAGChunk[] }> {
  try {
    logger.info(`[Groq LLM] Routing follow-up conversation via Llama-3`);

    // 1. Structure message log from past chat occurrences 
    const formattedHistory = chatHistory.map(msg => ({
      role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: msg.content
    }));

    // 2. Populate clinical prompt metrics using fully re-hydrated context elements
    const systemInstructions = `You are an expert clinical decision support AI assistant discussing a previous medical scan analysis.
Stick strictly to the facts from the analysis findings and provided retrieved medical literature. 
If you do not know the answer, state that explicitly. Never speculate beyond the evidence.

ANALYSIS CONTEXT:
- MODEL: ${analysisContext.modelDef.name}
- PREDICTION: ${analysisContext.prediction.predictedClass}
- CONFIDENCE: ${(analysisContext.prediction.confidence * 100).toFixed(1)}%
- SUMMARY: ${analysisContext.report.summary}
- FINDINGS: ${analysisContext.report.findings ? (Array.isArray(analysisContext.report.findings) ? analysisContext.report.findings.join('; ') : analysisContext.report.findings) : ''}

VISUAL METRICS ANALYSIS:
- Grad-CAM Visual Heatmap Layer Available: ${analysisContext.gradcam?.heatmapBase64 ? 'Yes (Focal hot-spots are mapped on-screen)' : 'No'}
- Heatmap Context: When asked about the heatmap or visual region highlights, explain that the color-coded overlay marks high-activation diagnostic weights inside the image mapping fields that matching traditional visual benchmarks for ${analysisContext.prediction.predictedClass}.

MEDICAL SOURCES RETRIEVED:
${analysisContext.report.retrievedSources ? analysisContext.report.retrievedSources.map((s) => `- ${s.source}: ${s.text}`).join('\n') : 'None'}

Instructions:
- Be highly factual, concise, and professional.
- Always append this exact warning string text at the end of your answer: "*Disclaimer: This information is AI-generated for educational purposes and must be verified by a licensed clinician.*"`;

    // 3. Dispatch to Groq API
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemInstructions },
        ...formattedHistory,
        { role: 'user', content: question }
      ],
      model: 'llama-3.3-70b-versatile', 
      temperature: 0.2,
      max_tokens: 800,
    });

    const answer = chatCompletion.choices[0]?.message?.content || "No message returned.";
    
    return {
      answer,
      sources: analysisContext.report.retrievedSources ? analysisContext.report.retrievedSources.slice(0, 2) : []
    };

  } catch (error) {
    logger.error(`[LLM Error] Groq Follow-up answer generation failed: ${error}`);
    throw error;
  }
}