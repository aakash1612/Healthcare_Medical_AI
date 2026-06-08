import { ChromaClient, Collection } from 'chromadb';
import { RAGChunk } from '../types';
import { logger } from '../utils/logger';

const COLLECTION_NAME = process.env.CHROMA_COLLECTION_MEDICAL || 'medical_knowledge';
const CHROMA_DATABASE = process.env.CHROMA_DATABASE || 'Medical_Chroma_host';
const CHROMA_TENANT = process.env.CHROMA_TENANT || 'f71c3ca6-7c89-4247-9775-01fdedd2feef';
const CHROMA_API_KEY = process.env.CHROMA_API_KEY;

let client: ChromaClient;
let collection: Collection;

async function getCollection(): Promise<Collection> {
  if (collection) {
    logger.info("[RAG] Using cached collection");
    return collection;
  }

  logger.info("[RAG] Connecting to Chroma Cloud gateway at api.trychroma.com");

  // 🌟 FIXED: Pass the Authorization header safely via the standard constructor options
  client = new ChromaClient({
    path: "https://api.trychroma.com",
    database: CHROMA_DATABASE,
    tenant: CHROMA_TENANT,
    // Sending both explicit configuration objects ensures fallback support
    auth: {
      provider: "token",
      credentials: CHROMA_API_KEY,
    },
    // Forcing standard gateway verification token straight to the client network layer
    headers: {
      "Authorization": `Bearer ${CHROMA_API_KEY}`
    }
  });

  try {
    logger.info("[RAG] Connecting to ChromaDB...");

    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: {
        description: "Medical journals, textbooks, clinical protocols",
      },
    });

    logger.info(
      `[RAG] Connected to ChromaDB collection: ${COLLECTION_NAME}`
    );
  } catch (err) {
    logger.error("[RAG] ChromaDB connection failed:", err);
    throw err;
  }

  return collection;
}

/**
 * Retrieves relevant medical knowledge chunks for a given condition.
 * The query is enriched with the model's predicted class for precision.
 *
 * @param condition  - e.g. "Pneumonia", "Grade 3 Diabetic Retinopathy"
 * @param modality   - e.g. "xray", "fundus_retina"
 * @param topK       - number of chunks to retrieve
 */
export async function retrieveMedicalKnowledge(
  condition: string,
  modality: string,
  topK = 5
): Promise<RAGChunk[]> {
  try {
    logger.info(
      `[RAG] Querying: condition="${condition}", modality="${modality}"`
    );

    logger.info("[RAG] Step 1 - Getting collection");

    const coll = await getCollection();

    logger.info("[RAG] Step 2 - Collection acquired");

    const queryText =
      `${condition} ${modality} diagnosis symptoms treatment clinical protocol`;

    logger.info(`[RAG] Step 3 - Query text: ${queryText}`);

    logger.info("[RAG] Step 4 - About to call Chroma query");

    const start = Date.now();

    const results = await coll.query({
      queryTexts: [queryText],
      nResults: topK,
      where: {
        modality: modality,
      },
    });

    logger.info(
      `[RAG] Step 5 - Query completed in ${Date.now() - start}ms`
    );

    logger.info(
      `[RAG] Step 6 - Result stats:
      ids=${results.ids?.[0]?.length ?? 0}
      docs=${results.documents?.[0]?.length ?? 0}
      metas=${results.metadatas?.[0]?.length ?? 0}
      distances=${results.distances?.[0]?.length ?? 0}`
    );

    if (!results.documents?.[0]) {
      logger.warn("[RAG] Step 7 - No documents returned");
      return [];
    }

    const mapped = results.documents[0].map((doc, i) => ({
      id: results.ids[0][i],
      text: doc ?? "",
      source:
        (results.metadatas?.[0]?.[i]?.source as string) ??
        "Medical Literature",
      relevanceScore: 1 - (results.distances?.[0]?.[i] ?? 0),
    }));

    logger.info(
      `[RAG] Step 8 - Returning ${mapped.length} chunks`
    );

    return mapped;
  } catch (error) {
    logger.error("[RAG] retrieveMedicalKnowledge FAILED:", error);
    throw error;
  }
}

/**
 * Ingests a new document into the vector store.
 * Call this when adding new medical textbook chapters or guidelines.
 */
export async function ingestDocument(chunks: {
  id: string;
  text: string;
  source: string;
  modality: string;
}[]): Promise<void> {
  const coll = await getCollection();

  await coll.upsert({
    ids: chunks.map((c) => c.id),
    documents: chunks.map((c) => c.text),
    metadatas: chunks.map((c) => ({ source: c.source, modality: c.modality })),
  });

  logger.info(`[RAG] Ingested ${chunks.length} chunks into ChromaDB`);
}

/**
 * Seed the vector DB with sample medical knowledge.
 * In production, replace with real PDF/textbook ingestion.
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