# Healthcare Medical AI System

> A production-grade, three-stage pipeline that takes a raw medical scan and turns it into a verified, explainable clinical report.

 ## Dashboard
 ![Dashboard](screenshots/fullfile.png)

```
Upload Scan → CNN + Grad-CAM → RAG Retrieval → LLM Report → Real-time Q&A
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React)                          │
│  Upload Zone │ Heatmap Viewer │ Report Panel │ Real-time Chat  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP + Socket.io
┌──────────────────────────▼──────────────────────────────────────┐
│                  BACKEND (Express + TypeScript)                  │
│  REST API │ Socket.io │ Model Registry │ Analysis Orchestrator  │
└──────┬───────────────────┬──────────────────────┬───────────────┘
       │                   │                      │
┌──────▼──────┐   ┌────────▼────────┐   ┌────────▼──────────────┐
│   MongoDB   │   │    ChromaDB     │   │  Python Service        │
│  Sessions   │   │  Medical RAG    │   │  FastAPI + PyTorch     │
│  Chat Hist  │   │  Vector Store   │   │  CNN + Grad-CAM        │
└─────────────┘   └─────────────────┘   └───────────────────────┘
                                                    │
                                         ┌──────────▼──────────┐
                                         │    OpenAI GPT-4o     │
                                         │  Report Generation   │
                                         │  Q&A Grounding       │
                                         └─────────────────────┘
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB (local or Atlas)
- Docker + Docker Compose (optional)

### 1. Clone & Install

```bash
git clone <repo>
cd explainable-medical-ai

# Install all dependencies
npm run install:all
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and add your OPENAI_API_KEY
```

### 3. Start Infrastructure (Docker)

```bash
# Start MongoDB + ChromaDB only
docker compose up mongodb chromadb -d
docker run -p 8000:8000 chromadb/chroma
```

### 4. Start All Services

```bash
npm run dev
# Opens:
#   Frontend  → http://localhost:5173
#   Backend   → http://localhost:5000
#   Python    → http://localhost:8000
```

---

## Training the Model

### Download Dataset
1. Go to: https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia
2. Download and extract to `python-service/data/chest_xray/`

Expected structure:
```
data/chest_xray/
  train/
    NORMAL/
    PNEUMONIA/
  val/
    NORMAL/
    PNEUMONIA/
  test/
    NORMAL/
    PNEUMONIA/
```

### Train

```bash
cd python-service
pip install -r requirements.txt
python train_xray.py --data_dir ./data/chest_xray --epochs 10
# Saves weights to: python-service/weights/xray_pneumonia_resnet50.pth
```

Expected accuracy: **~94–96%** on test set.

---

## Adding a New Model

This system is designed to be extended. To add a new model (e.g. diabetic retinopathy):

### 1. Python service — `model_loader.py`

Set `isActive: true` for `fundus-retinopathy-v1` and add weights:
```python
"fundus-retinopathy-v1": {
    "architecture": "efficientnet_b4",
    "weights_path": "./weights/fundus_retinopathy_effnet.pth",
    ...
}
```

### 2. Backend — `modelRegistry.ts`

Set `isActive: true`:
```typescript
{
  id: 'fundus-retinopathy-v1',
  isActive: true,   // ← flip this
  ...
}
```

### 3. RAG — `ragService.ts`

Add domain-specific knowledge chunks:
```typescript
{
  id: 'dr-grading-001',
  text: 'Grade 3 Diabetic Retinopathy...',
  modality: 'fundus_retina',
  source: 'AAO Preferred Practice Pattern',
}
```

That's it. The model selector, pipeline, and chat automatically pick it up.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind |
| Backend | Express.js + TypeScript + Socket.io |
| Database | MongoDB (sessions) + ChromaDB (vectors) |
| AI — Vision | PyTorch ResNet-50 + Grad-CAM |
| AI — RAG | ChromaDB embeddings |
| AI — LLM | OpenAI GPT-4o |
| Deployment | Docker + Docker Compose |

---

## Project Structure

```
explainable-medical-ai/
├── backend/                  # Express + TypeScript API
│   └── src/
│       ├── types/            # Shared type definitions
│       ├── models/           # Mongoose schemas + Model Registry
│       ├── services/         # Business logic
│       │   ├── analysisService.ts    # Pipeline orchestrator
│       │   ├── pythonBridge.ts       # CNN inference proxy
│       │   ├── ragService.ts         # ChromaDB retrieval
│       │   └── llmService.ts         # GPT-4o report + chat
│       ├── controllers/      # Route handlers
│       ├── routes/           # Express router
│       └── server.ts         # App entry + Socket.io
├── frontend/                 # React dashboard
│   └── src/
│       ├── components/       # UI components
│       ├── pages/            # Dashboard page
│       ├── hooks/            # useAnalysis hook
│       ├── services/         # API + Socket clients
│       └── types/            # Frontend types
├── python-service/           # FastAPI inference service
│   ├── models/               # Model loader + registry
│   ├── gradcam/              # Grad-CAM implementation
│   ├── main.py               # FastAPI app
│   ├── train_xray.py         # Training script
│   └── requirements.txt
└── docker-compose.yml
```

---

## API Reference

### POST `/api/analysis/upload`
Upload a medical image and start analysis.
```json
Body: FormData { image: File, modelId: string }
Returns: 202 { message, data: { modelId, fileName } }
```

### GET `/api/analysis/:sessionId`
Get a completed analysis session.

### POST `/api/analysis/:sessionId/chat`
Ask a follow-up question.
```json
Body: { question: string }
Returns: { answer: string, sources: RAGChunk[] }
```

### GET `/api/models`
List all models (active + inactive).

### WebSocket Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `join:session` | Client → Server | `sessionId` |
| `analysis:progress` | Server → Client | `{ status, message, percent }` |
| `analysis:complete` | Server → Client | `AnalysisResult` |
| `chat:message` | Client → Server | `{ sessionId, question }` |
| `chat:response` | Server → Client | `{ answer, sources }` |

---

## Disclaimer

This system is a research and educational tool. All AI-generated analyses must be reviewed by qualified medical professionals before any clinical use.
