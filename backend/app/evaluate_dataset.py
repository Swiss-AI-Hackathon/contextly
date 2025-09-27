import os, json, time, argparse, requests
from pathlib import Path
from eval import evaluate_predictions

ALLOWED_LABELS = [
    "plan_contact",
    "schedule_meeting",
    "update_contact_info_non_postal",
    "update_contact_info_postal_address",
    "update_kyc_activity",
    "update_kyc_origin_of_assets",
    "update_kyc_purpose_of_businessrelation",
    "update_kyc_total_assets",
]

def load_labels_from_json_obj(obj) -> list[str]:
    """
    Normalize various JSON shapes into a flat list of allowed labels.
    Supports:
      - PredictResponse-like: {"labels":[{"label":"..."}]}
      - Tasks array: [{"task_type":"..."}, ...]
      - Simple list of strings: ["schedule_meeting", ...]
    """
    labels: list[str] = []

    if isinstance(obj, dict):
        if isinstance(obj.get("labels"), list):
            for it in obj["labels"]:
                lab = it.get("label")
                if isinstance(lab, str) and lab in ALLOWED_LABELS:
                    # if a decision flag exists, respect it
                    decision = it.get("decision")
                    if decision is None or decision is True:
                        labels.append(lab)
        elif isinstance(obj.get("assigned_tasks"), list):
            for it in obj["assigned_tasks"]:
                lab = it.get("task_type")
                if isinstance(lab, str) and lab in ALLOWED_LABELS:
                    labels.append(lab)
        elif isinstance(obj.get("tasks"), list):
            for it in obj["tasks"]:
                lab = it.get("task_type")
                if isinstance(lab, str) and lab in ALLOWED_LABELS:
                    labels.append(lab)
    elif isinstance(obj, list):
        # either a tasks array or a list of strings
        for it in obj:
            if isinstance(it, dict):
                lab = it.get("task_type")
                if isinstance(lab, str) and lab in ALLOWED_LABELS:
                    labels.append(lab)
            elif isinstance(it, str) and it in ALLOWED_LABELS:
                labels.append(it)

    # dedupe, preserve order
    out, seen = [], set()
    for l in labels:
        if l not in seen:
            seen.add(l); out.append(l)
    return out

def load_expected_labels(json_path: Path) -> list[str]:
    obj = json.loads(json_path.read_text(encoding="utf-8"))
    return load_labels_from_json_obj(obj)

def call_backend_predict(api_base: str, transcript: str) -> dict:
    url = api_base.rstrip("/") + "/extract_labels"
    r = requests.post(url, json={"transcript": transcript}, timeout=180)
    if not r.ok:
        raise RuntimeError(f"Backend error {r.status_code}: {r.text[:500]}")
    # model may return a JSON object OR a JSON string inside choices[0].message.content (handled server-side),
    # but here we assume backend returns the final JSON already
    return r.json()

def main():
    ap = argparse.ArgumentParser(description="Evaluate transcripts vs expected labels (same-folder pairing).")
    ap.add_argument("--dir", default="data/validation", help="Folder containing *.txt and *.json with the same basename")
    ap.add_argument("--api", default="http://127.0.0.1:8000", help="Backend base URL (uses /extract_labels)")
    ap.add_argument("--out", default="data/validation/predictions", help="Where to save model predictions")
    args = ap.parse_args()

    root = Path(args.dir)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    # collect pairs
    txt_files = sorted(root.glob("*.txt"))
    pairs = []
    for txt in txt_files:
        exp = root / f"{txt.stem}.json"
        if exp.exists():
            pairs.append((txt, exp))
        else:
            print(f"[WARN] expected JSON missing for {txt.name} (looking for {exp.name})")

    if not pairs:
        print(f"[ERR] No pairs found in {root}. Expect <name>.txt + <name>.json")
        return

    all_true, all_pred = [], []
    t0 = time.time()

    for txt_path, exp_path in pairs:
        base = txt_path.stem
        transcript = txt_path.read_text(encoding="utf-8", errors="replace")
        y_true = load_expected_labels(exp_path)

        # call backend
        try:
            model_json = call_backend_predict(args.api, transcript)
        except Exception as e:
            print(f"[ERR] backend failed for {base}: {e}")
            continue

        # save prediction JSON for inspection
        pred_path = out_dir / f"{base}.json"
        pred_path.write_text(json.dumps(model_json, indent=2, ensure_ascii=False), encoding="utf-8")

        # normalize predicted labels
        y_pred = load_labels_from_json_obj(model_json)

        # per-file score (single-sample)
        score = evaluate_predictions([y_true], [y_pred])
        print(f"{base}: score={score:.3f} | true={y_true} | pred={y_pred}")

        all_true.append(y_true)
        all_pred.append(y_pred)

    agg = evaluate_predictions(all_true, all_pred)
    print("-" * 60)
    print(f"Aggregate score: {agg:.3f} over {len(all_true)} samples in {time.time()-t0:.1f}s")

if __name__ == "__main__":
    main()
