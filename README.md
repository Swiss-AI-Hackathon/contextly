# Contextly 
Contextly.ai turns talk into action — bridging human conversations with intelligent automation.

Contextly.ai transforms client–advisor conversations into actionable tasks using AI. It provides a React + Vite frontend and a FastAPI backend that connects to Hugging Face’s Apertus 8B Instruct model.

# 🚀 Features
## Frontend (React + Vite)

1. Upload or select transcript samples
2. View raw and cleaned transcripts with highlighted evidence
3. Extracted tasks and todos from client conversations

## Backend (FastAPI)

1. POST /extract_labels → classify transcript
2. GET /list_transcripts → list all available .txt
3. GET /get_transcript/{filename} → get transcript text

Swagger UI available at http://127.0.0.1:8000/docs

## AI Model

Apertus 8B Instruct 2509 via Hugging Face Router API
Optimized for high recall in compliance-sensitive banking tasks

## Coming soon...
1. Extracts 8 canonical task types with evidence spans, highlight text where tasks are extracted from within transcript
2. Send Feeback to the Model
3. Improve chatbox 

# ⚙️ Backend Setup (FastAPI)
1. Clone & enter backend
cd backend

2. Create and activate virtual environment
For macOS/Linux:
  python3 -m venv .venv
  source .venv/bin/activate
For Windows:
  python -m venv .venv
  .venv\Scripts\activate
3. Install dependencies
python -m pip install -r requirements.txt

4. Run FastAPI server
Development:
uvicorn app.main:app --reload --port 8000

Deployment:
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

5. Test backend & API Documentation
Open http://127.0.0.1:8000/docs to try endpoints directly.

## 🎨 Frontend Setup (React + Vite)
1. Clone & enter frontend
cd frontend

2. Install dependencies
npm install

3. Run dev server
npm run dev

Runs at http://localhost:5173.

Frontend will call /extract_labels → backend → Hugging Face model.


## 🌐 API Endpoints
POST /extract_labels → classify transcript

GET /list_transcripts → list all available .txt

GET /get_transcript/{filename} → get transcript text

## 🔒 Environment Variables
Backend requires Hugging Face API token:
HF_TOKEN=your_hf_token_here

Put this in backend/.env.

## 📊 Tech Stack
Frontend: React, Vite, TypeScript, CSS
Backend: Python, FastAPI, Uvicorn
AI Model: Hugging Face Apertus 8B Instruct
Deployment: Azure 

