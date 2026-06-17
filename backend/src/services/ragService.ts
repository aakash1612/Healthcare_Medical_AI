import { ChromaClient, Collection } from 'chromadb';
import { RAGChunk } from '../types';
import { logger } from '../utils/logger';

const COLLECTION_NAME = process.env.CHROMA_COLLECTION_MEDICAL || 'medical_knowledge';
const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost';
const CHROMA_PORT = parseInt(process.env.CHROMA_PORT || '8001');

let client: ChromaClient;
let collection: Collection;

async function getCollection(): Promise<Collection> {
  if (collection) return collection;

  client = new ChromaClient({ path: `http://${CHROMA_HOST}:${CHROMA_PORT}` });

  try {
    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { description: 'Medical journals, textbooks, clinical protocols' },
    });
    logger.info(`[RAG] Connected to ChromaDB collection: ${COLLECTION_NAME}`);
  } catch (err) {
    logger.error('[RAG] ChromaDB connection failed:', err);
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
  logger.info(`[RAG] Querying: condition="${condition}", modality="${modality}"`);

  const coll = await getCollection();

  const queryText = `${condition} ${modality} diagnosis symptoms treatment clinical protocol`;

  const results = await coll.query({
    queryTexts: [queryText],
    nResults: topK,
    where: { modality: modality },   // filter by imaging type if metadata exists
  });

  if (!results.documents?.[0]) return [];

  return results.documents[0].map((doc, i) => ({
    id: results.ids[0][i],
    text: doc ?? '',
    source: (results.metadatas?.[0]?.[i]?.source as string) ?? 'Medical Literature',
    relevanceScore: 1 - (results.distances?.[0]?.[i] ?? 0),
  }));
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
      text: 'Gradient-weighted Class Activation Mapping (Grad-CAM) highlights regions of a radiograph that most influenced the neural network\'s classification decision. High activation areas in the lower lung zones may indicate pneumonic consolidation. Clinicians should correlate AI heatmap findings with clinical presentation.',
      source: 'Radiology: Artificial Intelligence, 2022',
      modality: 'xray',
    },
  ];

  await ingestDocument(sampleChunks);
  logger.info('[RAG] Medical knowledge base seeded successfully');
}
