import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from .hf_client import call_hf

app = FastAPI()

class TranscriptInput(BaseModel):
    transcript: str

@app.post("/extract_labels")
def extract_labels(data: TranscriptInput):
    hf_response = call_hf(data.transcript)

    try:
        json_string = hf_response["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        # Handle cases where the structure is unexpected
        raise HTTPException(
            status_code=500,
            detail="Unexpected structure in model response."
        )

    try:
        final_result = json.loads(json_string)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Model content is not valid JSON: " + json_string
        )

    return final_result

# Return a list of available transcripts from the data directoryin the file system
@app.get("/list_transcripts")
def list_transcripts():
    import os
    data_dir = os.path.join(os.path.dirname(__file__), '../data/train')
    try:
        files = os.listdir(data_dir)
        transcripts = [f for f in files if f.endswith('.txt')]
        return {"transcripts": transcripts}
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Data directory not found."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# Endpoint to get a specific transcript by filename from the data directory
@app.get("/get_transcript/{filename}")
def get_transcript(filename: str):
    import os
    data_dir = os.path.join(os.path.dirname(__file__), '../data/train')
    file_path = os.path.join(data_dir, filename)
    try:
        with open(file_path, 'r') as file:
            content = file.read()
        return {"transcript": content}
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Transcript not found."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    