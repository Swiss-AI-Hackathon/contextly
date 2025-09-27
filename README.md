# ubs-hackathon-challenge
python -m venv .venv
# activate it
source .venv/bin/activate     # macOS/Linux
.venv\Scripts\activate        # Windows

python -m pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
