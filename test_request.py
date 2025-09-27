import requests
import json

API_URL = "http://127.0.0.1:8000/extract_labels"

with open("data/test/2Ap3qNu5T7jSauLhLAWRM8.txt", "r", encoding="utf-8") as f:
    transcript = f.read()

resp = requests.post(API_URL, json={"transcript": transcript})
print(json.dumps(resp.json(), indent=2))
