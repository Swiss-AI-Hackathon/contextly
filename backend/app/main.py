import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.hf import call_hf
from pathlib import Path

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

    # Remove any text before the first '{' and after the last '}'
    start_index = json_string.find('{')
    end_index = json_string.rfind('}') + 1
    if start_index == -1 or end_index == -1:
        raise HTTPException(
            status_code=500,
            detail="Model content does not contain valid JSON."
        )
    # Log the text that was removed for debugging
    
    json_string = json_string[start_index:end_index]

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
    try:
        # 1) sanitize filename
        safe_name = Path(filename).name
        data_dir = (Path(__file__).resolve().parent / ".." / "data" / "train").resolve()
        file_path = (data_dir / safe_name).resolve()

        if data_dir not in file_path.parents:
            raise HTTPException(status_code=400, detail="Invalid filename.")
        if file_path.suffix.lower() != ".txt":
            raise HTTPException(status_code=400, detail="Only .txt files are allowed.")

        # 2) read as bytes, then decode
        raw = file_path.read_bytes()

        # try UTF-8 (with BOM support), then sensible fallbacks
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            for enc in ("cp1252", "latin-1"):
                try:
                    text = raw.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                # couldn't decode with any known encodings
                raise

        return {"transcript": text}

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Transcript not found.")
    except UnicodeDecodeError:
        raise HTTPException(status_code=415, detail="Unsupported file encoding.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))