from flask import Flask, request, jsonify  # type: ignore
from flask_cors import CORS  # type: ignore
import joblib  # type: ignore
import json
import os
import re
from pathlib import Path
from dotenv import load_dotenv  # type: ignore
import google.generativeai as genai  # type: ignore

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
# Gemini config (use env var)
# ---------------------------
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
print("Gemini key loaded:", "YES" if GEMINI_API_KEY else "NO")

if GEMINI_API_KEY:
    # Print first few chars for confirmation (masking the rest)
    prefix = str(GEMINI_API_KEY)[:6]  # type: ignore
    print(f"Gemini key prefix: {prefix}...")
else:
    print("Gemini key prefix: NONE")

if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found. Gemini features will be disabled.")
else:
    genai.configure(api_key=GEMINI_API_KEY)


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
# Gemini Step 1: Translate to English (for better ML accuracy)
# ============================================================
def gemini_translate(text: str) -> str | None:
    """
    Returns translated English text, or None if Gemini unavailable/fails.
    Keeps meaning, names, locations. No extra commentary.
    """
    if not GEMINI_API_KEY:
        return None

    prompt = f"""
Translate the message into clear English.
Rules:
- Return ONLY the translated text (no JSON, no markdown).
- Keep meaning accurate, keep proper nouns (names/places).
- If already English, return it unchanged.

Message:
\"\"\"{text}\"\"\"
""".strip()

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(prompt)
        translated = (resp.text or "").strip()
        return translated if translated else None
    except Exception as e:
        print("Gemini translate error:", repr(e))
        return None

# ============================================================
# Gemini Step 3: Support/Validate local ML result
# ============================================================
def gemini_support(original: str, translated: str, local_label: str, local_type: str) -> dict:
    """
    Returns:
      {
        "agree": bool,
        "suggested_label": str|None,
        "suggested_type": str|None,
        "support": str|None
      }
    Gemini will either agree and give a short support reason,
    or suggest a corrected label/type (still within allowed lists).
    """
    if not GEMINI_API_KEY:
        return {"agree": True, "suggested_label": None, "suggested_type": None, "support": None}

    prompt = f"""
You are validating a barangay complaint classification.

Allowed labels: {VALID_LABELS}
Allowed types: {VALID_TYPES}

Type-to-label mapping:
{TYPE_TO_LABEL}

Given:
- Original message:
\"\"\"{original}\"\"\"

- English translation:
\"\"\"{translated}\"\"\"

- Local model result:
label="{local_label}"
type="{local_type}"

Task:
1) Decide if the local result is correct.
2) If correct: return JSON with agree=true and a short support reason (1 sentence).
3) If wrong: return JSON with agree=false and provide corrected label/type that follow the allowed lists and mapping.

Return ONLY JSON (no markdown), exactly:
{{
  "agree": true/false,
  "suggested_label": "urgent|non-urgent|spam|null",
  "suggested_type": "<one allowed type>|null",
  "support": "<short reason or null>"
}}
""".strip()

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(prompt)
        cleaned = (resp.text or "").strip()

        if cleaned.startswith("```"):
            parts = cleaned.split("```")
            cleaned = parts[1] if len(parts) > 1 else cleaned
            cleaned = cleaned.replace("json", "", 1).strip()

        parsed = json.loads(cleaned)

        agree = bool(parsed.get("agree", True))
        suggested_label = parsed.get("suggested_label", None)
        suggested_type = parsed.get("suggested_type", None)
        support = parsed.get("support", None)

        # normalize
        if isinstance(suggested_label, str):
            suggested_label = suggested_label.strip().lower()
        if isinstance(suggested_type, str):
            suggested_type = suggested_type.strip().lower()
        if isinstance(support, str):
            support = support.strip()

        # validate suggestions
        if suggested_label not in VALID_LABELS:
            suggested_label = None
        if suggested_type not in VALID_TYPES:
            suggested_type = None

        # force consistency if Gemini suggests a type
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
        print("Gemini support error:", repr(e))
        return {"agree": True, "suggested_label": None, "suggested_type": None, "support": None}

# ---------------------------
# Main endpoint
# ---------------------------
@app.route("/classify", methods=["POST"])
def classify():
    data = request.get_json(silent=True) or {}
    raw_message = data.get("message", "")

    # quick spam gate using raw (so we don't waste Gemini calls)
    if looks_like_nonsense(raw_message):
        return jsonify({
            "message": raw_message,
            "translated": None,
            "label": "spam",
            "type": "off-topic",
            "source": "rule",
            "support": None
        })

    # Step 1: Translate using Gemini (if available)
    translated = gemini_translate(raw_message) or raw_message

    # Step 2: Classify using LOCAL ML on translated text
    message = normalize_text(translated)

    label_pred, label_conf = predict_with_confidence(label_model, message)
    type_pred, type_conf = predict_with_confidence(type_model, message)

    label_pred = str(label_pred).strip().lower()
    type_pred = str(type_pred).strip().lower()

    if type_pred not in VALID_TYPES:
        type_conf = 0.0

    LABEL_OK = (label_conf is None) or (label_conf >= 0.70)
    TYPE_OK = (type_conf is None) or (type_conf >= 0.60)

    expected = TYPE_TO_LABEL.get(type_pred)
    final_label = expected if expected else label_pred
    final_type = type_pred if type_pred in VALID_TYPES else "off-topic"

    # If local is low-confidence, you can still proceed — Gemini support may help.
    # Step 3: Gemini "support/validate" the LOCAL result (using original + translation)
    support_result = gemini_support(
        original=raw_message,
        translated=translated,
        local_label=final_label,
        local_type=final_type
    )

    # If Gemini disagrees AND it provides a valid suggestion, override the final output
    if support_result.get("agree") is False and support_result.get("suggested_label") and support_result.get("suggested_type"):
        final_label = support_result["suggested_label"]
        final_type = support_result["suggested_type"]
        source = "local+gemini_override"
    else:
        source = "local+gemini_support" if GEMINI_API_KEY else "local_only"

    return jsonify({
        "message": raw_message,
        "translated": translated if translated != raw_message else None,
        "label": final_label,
        "type": final_type,
        "source": source,
        "confidence": {"label": label_conf, "type": type_conf},
        "support": support_result.get("support")
    })

# ---------------------------
# Run
# ---------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
