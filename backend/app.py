# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import joblib
import json
import os

# Load trained models
label_model = joblib.load("label_model.pkl")
type_model = joblib.load("type_model.pkl")

# Configure Gemini API
genai.configure(api_key="AIzaSyDg_EbxqAGrgiAAOBN1jZIoPVzjeeJaXvk")

app = Flask(__name__)
CORS(app)

def gemini_refine_text(text):
    prompt = f"""
    Classify the complaint into EXACTLY one of the following labels:
    - urgent
    - non-urgent
    - spam

    Then classify the type:
    Urgent → ["medical emergency", "fire emergency", "fights"]
    Non-Urgent → ["infrastructure", "noise", "waste"]
    Spam → ["irrelevant"]

    STRICT RULES:
    - If the message does NOT clearly match any valid type → mark it as spam.
    - If the message is unrelated, nonsense, empty, promotional, insulting, or unclear → spam.
    - If unsure between two categories → spam.
    - Always respond ONLY with JSON.

    Example:
    {{"label": "spam", "type": "irrelevant"}}

    Text: "{text}"
    """

    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(prompt)

    try:
        cleaned = response.text.strip()

        # Remove code block wrappers if any
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            cleaned = cleaned.replace("json", "", 1).strip()

        parsed = json.loads(cleaned)

        # Enforce spam fallback if unknown or invalid
        valid_labels = ["urgent", "non-urgent", "spam"]
        valid_types = ["medical emergency", "fire emergency", "fights",
                       "infrastructure", "noise", "waste",
                       "irrelevant"]

        if parsed.get("label") not in valid_labels:
            return {"label": "spam", "type": "irrelevant"}

        if parsed.get("type") not in valid_types:
            return {"label": "spam", "type": "irrelevant"}

        return parsed

    except:
        # Any failure means spam
        return {"label": "spam", "type": "irrelevant"}

@app.route("/classify", methods=["POST"])
def classify():
    data = request.get_json()
    message = data.get("message", "")

    # Local predictions (backup only)
    label_pred = label_model.predict([message])[0]
    type_pred = type_model.predict([message])[0]

    gem = gemini_refine_text(message)

    # Gemini always returns something valid or spam fallback
    final_label = gem["label"]
    final_type = gem["type"]

    return jsonify({
        "message": message,
        "label": final_label,
        "type": final_type
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)