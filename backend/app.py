from flask import Flask, request, jsonify  # type: ignore
from flask_cors import CORS  # type: ignore
import joblib  # type: ignore
import json
import os
import re
import requests as http_requests  # type: ignore
from pathlib import Path
from dotenv import load_dotenv  # type: ignore

# ============================================================
# Load .env from the SAME folder as this app.py (bulletproof)
# ============================================================
env_path = Path(__file__).with_name(".env")
load_dotenv(dotenv_path=env_path)

app = Flask(__name__)
CORS(app)

# ---------------------------
# Load trained models
# ---------------------------
label_model = joblib.load("label_model.pkl")
type_model = joblib.load("type_model.pkl")

# ---------------------------
# Groq config (use env var)
# ---------------------------
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = "llama-3.3-70b-versatile"  # free tier, best accuracy
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
print("Groq key loaded:", "YES" if GROQ_API_KEY else "NO")


# ---------------------------
# Allowed labels/types
# ---------------------------
VALID_LABELS = ["urgent", "non-urgent", "spam"]
VALID_TYPES = [
    "medical emergency",
    "fire emergency",
    "violence",
    "crime",
    "infrastructure",
    "flooding/drainage",
    "waste",                 # changed
    "noise complaint",
    "animal complaint",
    "illegal activities",
    "curfew violation",
    "sexual assault",
    "off-topic",             # merged here
]

TYPE_TO_LABEL = {
    "medical emergency": "urgent",
    "fire emergency": "urgent",
    "violence": "urgent",
    "crime": "urgent",
    "sexual assault": "urgent",

    "infrastructure": "non-urgent",
    "flooding/drainage": "non-urgent",
    "waste": "non-urgent",                 # changed
    "noise complaint": "non-urgent",
    "animal complaint": "non-urgent",
    "illegal activities": "non-urgent",
    "curfew violation": "non-urgent",

    "off-topic": "spam",                   # changed
}


# ---------------------------
# Text normalization
# ---------------------------
def normalize_text(text: str) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text

def looks_like_nonsense(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return True
    if len(t) <= 2:
        return True
    letters = sum(ch.isalpha() for ch in t)
    if letters == 0:
        return True
    if letters / max(len(t), 1) < 0.25:
        return True
    return False

# ---------------------------
# Local predictions with confidence
# ---------------------------
def predict_with_confidence(model, text: str):
    try:
        proba = model.predict_proba([text])[0]
        classes = list(model.classes_)
        best_i = int(proba.argmax())
        return classes[best_i], float(proba[best_i])
    except Exception:
        pred = model.predict([text])[0]
        return pred, None

# ============================================================
# Groq: Validate/support the local ML classification
# ============================================================
def groq_validate(message: str, local_label: str, local_type: str) -> dict:
    """
    Uses Groq (Llama 3) to validate the local ML result.
    Returns: { agree, suggested_label, suggested_type, support }
    Falls back gracefully if Groq is unavailable.
    """
    if not GROQ_API_KEY:
        return {"agree": True, "suggested_label": None, "suggested_type": None, "support": None}

    prompt = f"""You are validating a barangay complaint classification.

Allowed labels: {VALID_LABELS}
Allowed types: {VALID_TYPES}

Type-to-label mapping:
{json.dumps(TYPE_TO_LABEL)}

Message: \"\"\"{message}\"\"\"

Local model result: label="{local_label}", type="{local_type}"

If correct: return JSON with agree=true and a short support reason.
If wrong: return JSON with agree=false and corrected label/type from allowed lists.

Return ONLY JSON:
{{"agree": true/false, "suggested_label": "...|null", "suggested_type": "...|null", "support": "...|null"}}"""

    try:
        resp = http_requests.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 200,
            },
            timeout=15,
        )
        resp.raise_for_status()
        result = resp.json()
        cleaned = result["choices"][0]["message"]["content"].strip()

        if cleaned.startswith("```"):
            parts = cleaned.split("```")
            cleaned = parts[1] if len(parts) > 1 else cleaned
            cleaned = cleaned.replace("json", "", 1).strip()

        parsed = json.loads(cleaned)

        agree = bool(parsed.get("agree", True))
        suggested_label = parsed.get("suggested_label")
        suggested_type = parsed.get("suggested_type")
        support = parsed.get("support")

        if isinstance(suggested_label, str):
            suggested_label = suggested_label.strip().lower()
        if isinstance(suggested_type, str):
            suggested_type = suggested_type.strip().lower()
        if isinstance(support, str):
            support = support.strip()

        if suggested_label not in VALID_LABELS:
            suggested_label = None
        if suggested_type not in VALID_TYPES:
            suggested_type = None

        if suggested_type:
            expected = TYPE_TO_LABEL.get(suggested_type)
            if expected:
                suggested_label = expected

        return {
            "agree": agree,
            "suggested_label": suggested_label,
            "suggested_type": suggested_type,
            "support": support if support else None
        }
    except Exception as e:
        print("Groq validate error:", repr(e))
        return {"agree": True, "suggested_label": None, "suggested_type": None, "support": None}

# ---------------------------
# Main endpoint
# ---------------------------
@app.route("/classify", methods=["POST"])
def classify():
    data = request.get_json(silent=True) or {}
    raw_message = data.get("message", "")

    # quick spam gate
    if looks_like_nonsense(raw_message):
        return jsonify({
            "message": raw_message,
            "translated": None,
            "label": "spam",
            "type": "off-topic",
            "source": "rule",
            "support": None
        })

    # Classify using LOCAL ML
    message = normalize_text(raw_message)

    label_pred, label_conf = predict_with_confidence(label_model, message)
    type_pred, type_conf = predict_with_confidence(type_model, message)

    label_pred = str(label_pred).strip().lower()
    type_pred = str(type_pred).strip().lower()

    if type_pred not in VALID_TYPES:
        type_conf = 0.0

    expected = TYPE_TO_LABEL.get(type_pred)
    final_label = expected if expected else label_pred
    final_type = type_pred if type_pred in VALID_TYPES else "off-topic"

    # Groq validation: let AI verify the local ML result
    validation = groq_validate(raw_message, final_label, final_type)

    if validation.get("agree") is False and validation.get("suggested_label") and validation.get("suggested_type"):
        final_label = validation["suggested_label"]
        final_type = validation["suggested_type"]
        source = "local+groq_override"
    else:
        source = "local+groq_support" if GROQ_API_KEY else "local_only"

    return jsonify({
        "message": raw_message,
        "translated": None,
        "label": final_label,
        "type": final_type,
        "source": source,
        "confidence": {"label": label_conf, "type": type_conf},
        "support": validation.get("support")
    })

# ---------------------------
# Run
# ---------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
