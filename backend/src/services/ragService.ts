import axios from 'axios';
import { RAGChunk } from '../types';
import { logger } from '../utils/logger';

const COLLECTION_NAME = process.env.CHROMA_COLLECTION_MEDICAL || 'medical_knowledge';
const CHROMA_DATABASE = process.env.CHROMA_DATABASE || 'Medical_Chroma_host';
const CHROMA_TENANT = process.env.CHROMA_TENANT || 'f71c3ca6-7c89-4247-9775-01fdedd2feef';
const CHROMA_API_KEY = process.env.CHROMA_API_KEY;

const BASE_URL = 'https://api.trychroma.com/api/v1';

/**
 * Helper to get the absolute collection ID from Chroma Cloud via direct REST call
 */
async function getCollectionId(): Promise<string> {
  logger.info(`[RAG] Fetching Collection ID for: ${COLLECTION_NAME}`);
  
  try {
    const response = await axios.get(`${BASE_URL}/collections/${COLLECTION_NAME}`, {
      params: { tenant: CHROMA_TENANT, database: CHROMA_DATABASE },
      headers: {
        'Authorization': `Bearer ${CHROMA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.id;
  } catch (err: any) {
    // If collection doesn't exist yet, automatically create it
    if (err.response?.status === 404) {
      logger.info(`[RAG] Collection not found. Creating collection: ${COLLECTION_NAME}`);
      const createResponse = await axios.post(
        `${BASE_URL}/collections`,
        { name: COLLECTION_NAME, metadata: { description: "Medical guidelines" } },
        {
          params: { tenant: CHROMA_TENANT, database: CHROMA_DATABASE },
          headers: { 'Authorization': `Bearer ${CHROMA_API_KEY}`, 'Content-Type': 'application/json' }
        }
      );
      return createResponse.data.id;
    }
    logger.error('[RAG] Failed to acquire collection ID via REST:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Retrieves relevant medical knowledge chunks for a given condition.
 */
export async function retrieveMedicalKnowledge(
  condition: string,
  modality: string,
  topK = 5
): Promise<RAGChunk[]> {
  try {
    logger.info(`[RAG] Querying via REST: condition="${condition}", modality="${modality}"`);
    logger.info("[RAG] Step 1 - Getting collection ID");
    
    const collectionId = await getCollectionId();
    
    logger.info("[RAG] Step 2 - Collection ID acquired");
    const queryText = `${condition} ${modality} diagnosis symptoms treatment clinical protocol`;
    logger.info(`[RAG] Step 3 - Query text: ${queryText}`);
    logger.info("[RAG] Step 4 - Running direct REST query to Chroma Cloud");

    const start = Date.now();
    const response = await axios.post(
      `${BASE_URL}/collections/${collectionId}/query`,
      {
        query_texts: [queryText],
        n_results: topK,
        where: { modality: modality }
      },
      {
        headers: {
          'Authorization': `Bearer ${CHROMA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`[RAG] Step 5 - Query completed in ${Date.now() - start}ms`);
    const results = response.data;

    if (!results.documents?.[0]) {
      logger.warn("[RAG] Step 7 - No documents returned");
      return [];
    }

    const mapped = results.documents[0].map((doc: string, i: number) => ({
      id: results.ids[0][i],
      text: doc ?? "",
      source: (results.metadatas?.[0]?.[i]?.source as string) ?? "Medical Literature",
      relevanceScore: results.distances?.[0] ? (1 - results.distances[0][i]) : 1,
    }));

    logger.info(`[RAG] Step 8 - Returning ${mapped.length} chunks`);
    return mapped;
  } catch (error: any) {
    logger.error("[RAG] retrieveMedicalKnowledge FAILED:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * Ingests new documents into the vector store.
 */
export async function ingestDocument(chunks: {
  id: string;
  text: string;
  source: string;
  modality: string;
}[]): Promise<void> {
  try {
    const collectionId = await getCollectionId();
    await axios.post(
      `${BASE_URL}/collections/${collectionId}/upsert`,
      {
        ids: chunks.map((c) => c.id),
        documents: chunks.map((c) => c.text),
        metadatas: chunks.map((c) => ({ source: c.source, modality: c.modality })),
      },
      {
        headers: {
          'Authorization': `Bearer ${CHROMA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info(`[RAG] Ingested ${chunks.length} chunks directly into Chroma Cloud`);
  } catch (err: any) {
    logger.error('[RAG] Direct Ingestion failed:', err.response?.data || err.message);
  }
}

/**
 * Seed the vector DB with sample medical knowledge.
 */
export async function seedMedicalKnowledge(): Promise<void> {
  const sampleChunks = [
    {
      id: 'pneumonia-001',
      text: 'Pneumonia is an infection that inflames air sacs in one or both lungs. The air sacs may fill with fluid or pus, causing cough with phlegm or pus, fever, chills, and difficulty breathing. Radiographic findings include consolidation, ground-glass opacity, and air bronchograms.',
      source: "Harrison's Principles of Internal Medicine, Ch. 121",
      modality: 'xray',
    },
    {
      id: 'pneumonia-002',
      text: 'Bacterial pneumonia often presents with lobar consolidation on chest radiograph. Common pathogens include Streptococcus pneumoniae (most common), Haemophilus influenzae, and Klebsiella pneumoniae. Treatment typically involves beta-lactam antibiotics.',
      source: 'Chest Radiology: Patterns and Differential Diagnoses, 7th Ed.',
      modality: 'xray',
    },
    {
      id: 'pneumonia-003',
      text: 'Viral pneumonia, including COVID-19 pneumonia, typically shows bilateral ground-glass opacities with peripheral distribution. Interstitial patterns and bilateral infiltrates are common. Supportive care is the mainstay of treatment.',
      source: 'American Journal of Respiratory and Critical Care Medicine, 2023',
      modality: 'xray',
    },
    {
      id: 'normal-xray-001',
      text: 'A normal chest radiograph shows clear lung fields without consolidation, effusion, or pneumothorax. The costophrenic angles are sharp, the cardiac silhouette is within normal limits (cardiothoracic ratio < 0.5), and the lung markings are visible to the periphery.',
      source: 'Fundamentals of Diagnostic Radiology, Brant & Helms',
      modality: 'xray',
    },
    {
      id: 'gradcam-interpretation-001',
      text: "Gradient-weighted Class Activation Mapping (Grad-CAM) highlights regions of a radiograph that most influenced the neural network's classification decision. High activation areas in the lower lung zones may indicate pneumonic consolidation. Clinicians should correlate AI heatmap findings with clinical presentation.",
      source: 'Radiology: Artificial Intelligence, 2022',
      modality: 'xray',
    },
  ];

  await ingestDocument(sampleChunks);
  logger.info('[RAG] Medical knowledge base seeded successfully');
}