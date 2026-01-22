from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import json
import os
import re

import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# ---------------------------
# Load trained models
# ---------------------------
label_model = joblib.load("label_model.pkl")
type_model = joblib.load("type_model.pkl")

# ---------------------------
# Gemini config (use env var)
# ---------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# ---------------------------
# Allowed labels/types (UPDATED to your new dataset types)
# ---------------------------
VALID_LABELS = ["urgent", "non-urgent", "spam"]
VALID_TYPES = [
    "medical emergency",
    "fire emergency",
    "violence",
    "crime",
    "infrastructure",
    "flooding/drainage",
    "waste management",
    "noise complaint",
    "animal complaint",
    "illegal activities",
    "curfew violation",
    "sexual assault",
    "non sense",
    "off-topic",
]

# Label mapping by type (helps sanity-check)
TYPE_TO_LABEL = {
    "medical emergency": "urgent",
    "fire emergency": "urgent",
    "violence": "urgent",
    "crime": "urgent",
    "sexual assault": "urgent",

    "infrastructure": "non-urgent",
    "flooding/drainage": "non-urgent",
    "waste management": "non-urgent",
    "noise complaint": "non-urgent",
    "animal complaint": "non-urgent",
    "illegal activities": "non-urgent",
    "curfew violation": "non-urgent",

    "non sense": "spam",
    "off-topic": "spam",
}

# ---------------------------
# Text normalization
# ---------------------------
def normalize_text(text: str) -> str:
    text = (text or "").strip().lower()
    # reduce repeated whitespace
    text = re.sub(r"\s+", " ", text)
    return text

def looks_like_nonsense(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return True
    # very short junk
    if len(t) <= 2:
        return True
    # mostly non-letters
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
    """
    Returns (pred, confidence) where confidence is max predicted probability if available.
    """
    try:
        proba = model.predict_proba([text])[0]
        classes = list(model.classes_)
        best_i = int(proba.argmax())
        return classes[best_i], float(proba[best_i])
    except Exception:
        # If model has no predict_proba
        pred = model.predict([text])[0]
        return pred, None

# ---------------------------
# Gemini classification (only when needed)
# ---------------------------
def gemini_classify(text: str) -> dict:
    if not GEMINI_API_KEY:
        return {"label": None, "type": None}

    # Make Gemini follow your exact schema + exact types
    prompt = f"""
You are a strict JSON classifier for barangay complaints.

Return ONLY JSON (no markdown, no code fences) like:
{{"label":"urgent|non-urgent|spam", "type":"<one of the allowed types>"}}

Allowed labels:
{VALID_LABELS}

Allowed types (choose exactly ONE):
{VALID_TYPES}

Rules:
- If the message is empty, nonsense, unrelated, promotional, insulting, or unclear -> label=spam and type="non sense" OR "off-topic" (pick the best).
- If uncertain between two types -> pick the safer option and if still uncertain -> spam.
- Ensure the label matches the type using this mapping:
{TYPE_TO_LABEL}

Message:
\"\"\"{text}\"\"\"
"""

    model = genai.GenerativeModel("gemini-2.5-flash")
    resp = model.generate_content(prompt)

    try:
        cleaned = (resp.text or "").strip()

        # remove code fences if Gemini adds them
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            cleaned = cleaned.replace("json", "", 1).strip()

        parsed = json.loads(cleaned)

        label = str(parsed.get("label", "")).strip().lower()
        typ = str(parsed.get("type", "")).strip().lower()

        if label not in VALID_LABELS:
            return {"label": None, "type": None}
        if typ not in VALID_TYPES:
            return {"label": None, "type": None}

        # force label/type consistency
        expected_label = TYPE_TO_LABEL.get(typ)
        if expected_label and expected_label != label:
            label = expected_label

        return {"label": label, "type": typ}

    except Exception:
        return {"label": None, "type": None}

# ---------------------------
# Main endpoint
# ---------------------------
@app.route("/classify", methods=["POST"])
def classify():
    data = request.get_json(silent=True) or {}
    raw_message = data.get("message", "")
    message = normalize_text(raw_message)

    # Hard spam gate for empty/nonsense
    if looks_like_nonsense(message):
        return jsonify({
            "message": raw_message,
            "label": "spam",
            "type": "non sense",
            "source": "rule"
        })

    # Local predictions (primary)
    label_pred, label_conf = predict_with_confidence(label_model, message)
    type_pred, type_conf = predict_with_confidence(type_model, message)

    # normalize local outputs
    label_pred = str(label_pred).strip().lower()
    type_pred = str(type_pred).strip().lower()

    # If local predicted types are outside your new type set, treat as low-confidence
    if type_pred not in VALID_TYPES:
        type_conf = 0.0

    # Confidence thresholds (tune these)
    LABEL_OK = (label_conf is None) or (label_conf >= 0.70)
    TYPE_OK = (type_conf is None) or (type_conf >= 0.60)

    # If local is confident, trust it
    if LABEL_OK and TYPE_OK:
        # enforce label/type consistency if possible
        expected = TYPE_TO_LABEL.get(type_pred)
        final_label = expected if expected else label_pred

        return jsonify({
            "message": raw_message,
            "label": final_label,
            "type": type_pred,
            "source": "local",
            "confidence": {"label": label_conf, "type": type_conf}
        })

    # Otherwise, ask Gemini and only use it if valid
    gem = gemini_classify(raw_message)
    if gem["label"] and gem["type"]:
        return jsonify({
            "message": raw_message,
            "label": gem["label"],
            "type": gem["type"],
            "source": "gemini",
            "confidence": {"label": label_conf, "type": type_conf}
        })

    # Final fallback to local
    expected = TYPE_TO_LABEL.get(type_pred)
    final_label = expected if expected else label_pred

    return jsonify({
        "message": raw_message,
        "label": final_label,
        "type": type_pred if type_pred in VALID_TYPES else "off-topic",
        "source": "local_fallback",
        "confidence": {"label": label_conf, "type": type_conf}
    })

# ---------------------------
# Run
# ---------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
