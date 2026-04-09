from flask import Flask, request, jsonify  # type: ignore
from flask_cors import CORS  # type: ignore
import joblib  # type: ignore
import json
import os
import re
import threading
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
# Groq: Translate Tagalog/slang to English
# ---------------------------
def groq_translate(message: str) -> str:
    """
    Detects if the message is in Tagalog, Filipino slang, or mixed
    Taglish and translates to English using Groq.
    Returns translated English text, or original if already English.
    """
    if not GROQ_API_KEY:
        return message

    prompt = f"""You are a translator. Determine if this message is in Tagalog, Filipino slang, Taglish (mixed Tagalog-English), or any Filipino dialect.

Message: \"\"\"{message}\"\"\"

If the message is already in English, return it as-is.
If it contains Tagalog, Filipino slang, or Taglish, translate the ENTIRE message to clear English while preserving the meaning and urgency.

Return ONLY the translated English text, nothing else. No quotes, no explanation."""

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
                "max_tokens": 300,
            },
            timeout=15,
        )
        resp.raise_for_status()
        result = resp.json()
        translated = result["choices"][0]["message"]["content"].strip()
        # Remove surrounding quotes if the model added them
        if (translated.startswith('"') and translated.endswith('"')) or \
           (translated.startswith("'") and translated.endswith("'")):
            translated = translated[1:-1].strip()
        return translated if translated else message
    except Exception as e:
        print("Groq translate error:", repr(e))
        return message

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
# Groq: Classify the complaint type directly using AI
# ============================================================
def groq_classify(message: str, local_label: str, local_type: str, type_conf: float) -> dict:
    """
    Uses Groq (Llama 3) to classify or validate the complaint type.
    When local confidence is low (<0.7), Groq does primary classification.
    When high, Groq validates the local result.
    Returns: { agree, suggested_label, suggested_type, support }
    Falls back gracefully if Groq is unavailable.
    """
    if not GROQ_API_KEY:
        return {"agree": True, "suggested_label": None, "suggested_type": None, "support": None}

    low_confidence = type_conf is None or type_conf < 0.7

    if low_confidence:
        prompt = f"""You are a barangay complaint classifier. Classify this complaint message.

Allowed labels: {VALID_LABELS}
Allowed types: {VALID_TYPES}

Type-to-label mapping (use this to determine the correct label from the type):
{json.dumps(TYPE_TO_LABEL)}

Message: \"\"\"{message}\"\"\"

Classify the message into the most accurate type from the allowed types list.
Then determine the label using the type-to-label mapping.

Return ONLY valid JSON (no markdown, no explanation):
{{"agree": false, "suggested_label": "<label>", "suggested_type": "<type>", "support": "<brief reason>"}}"""
    else:
        prompt = f"""You are validating a barangay complaint classification.

Allowed labels: {VALID_LABELS}
Allowed types: {VALID_TYPES}

Type-to-label mapping:
{json.dumps(TYPE_TO_LABEL)}

Message: \"\"\"{message}\"\"\"

Local model result: label="{local_label}", type="{local_type}" (confidence: {type_conf:.2f})

If the type is correct: return JSON with agree=true and a short support reason.
If the type is wrong: return JSON with agree=false and the corrected label/type from the allowed lists.

Return ONLY valid JSON (no markdown, no explanation):
{{"agree": true/false, "suggested_label": "<label or null>", "suggested_type": "<type or null>", "support": "<brief reason or null>"}}"""

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
        print("Groq classify error:", repr(e))
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

    # Translate Tagalog/slang to English first
    translated = groq_translate(raw_message)
    is_translated = translated.lower().strip() != raw_message.lower().strip()

    # Classify using LOCAL ML (use translated text for better accuracy)
    message = normalize_text(translated)

    label_pred, label_conf = predict_with_confidence(label_model, message)
    type_pred, type_conf = predict_with_confidence(type_model, message)

    label_pred = str(label_pred).strip().lower()
    type_pred = str(type_pred).strip().lower()

    if type_pred not in VALID_TYPES:
        type_conf = 0.0

    expected = TYPE_TO_LABEL.get(type_pred)
    final_label = expected if expected else label_pred
    final_type = type_pred if type_pred in VALID_TYPES else "off-topic"

    # Groq AI: classify or validate the type (use both original and translated)
    classify_msg = translated if is_translated else raw_message
    validation = groq_classify(classify_msg, final_label, final_type, type_conf)

    # Groq overrides when it disagrees OR when local confidence is low
    if validation.get("agree") is False:
        if validation.get("suggested_type"):
            final_type = validation["suggested_type"]
            source = "groq_classified"
        if validation.get("suggested_label"):
            final_label = validation["suggested_label"]
        elif validation.get("suggested_type"):
            # Derive label from type mapping
            expected_from_groq = TYPE_TO_LABEL.get(final_type)
            if expected_from_groq:
                final_label = expected_from_groq
            source = "groq_classified"
        else:
            source = "local+groq_support" if GROQ_API_KEY else "local_only"
    else:
        source = "local+groq_support" if GROQ_API_KEY else "local_only"

    return jsonify({
        "message": raw_message,
        "translated": translated if is_translated else None,
        "label": final_label,
        "type": final_type,
        "source": source,
        "confidence": {"label": label_conf, "type": type_conf},
        "support": validation.get("support")
    })

# ---------------------------
# FAQ Chat Proxy (Groq)
# ---------------------------
GROQ_FAQ_MODEL = "llama-3.1-8b-instant"  # fast model for FAQ chat

@app.route("/api/chat", methods=["POST"])
def faq_chat():
    """Proxy FAQ chatbot requests to Groq — keeps API key server-side."""
    if not GROQ_API_KEY:
        return jsonify({"error": "Groq API key not configured"}), 500

    data = request.get_json(force=True)
    messages = data.get("messages")
    if not messages or not isinstance(messages, list):
        return jsonify({"error": "messages array is required"}), 400

    # Validate message structure
    for msg in messages:
        if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
            return jsonify({"error": "Each message must have role and content"}), 400
        if msg["role"] not in ("system", "user", "assistant"):
            return jsonify({"error": f"Invalid role: {msg['role']}"}), 400
        if not isinstance(msg["content"], str) or len(msg["content"]) > 5000:
            return jsonify({"error": "Content must be a string under 5000 chars"}), 400

    try:
        resp = http_requests.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_FAQ_MODEL,
                "messages": messages,
                "temperature": 0.1,
                "max_tokens": 300,
            },
            timeout=15,
        )
        resp.raise_for_status()
        result = resp.json()
        answer = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        return jsonify({"answer": answer})
    except http_requests.exceptions.Timeout:
        return jsonify({"error": "Groq API timed out"}), 504
    except http_requests.exceptions.RequestException as e:
        return jsonify({"error": f"Groq API error: {str(e)}"}), 502

# ---------------------------
# Firebase Admin + Push Notifications
# ---------------------------
import firebase_admin  # type: ignore
from firebase_admin import credentials, firestore as admin_firestore  # type: ignore

def init_firebase_admin():
    """Initialize Firebase Admin SDK for Firestore listening."""
    # Option 1: Service account JSON string from environment variable (for cloud deployment)
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if service_account_json:
        try:
            import json as _json
            service_account_info = _json.loads(service_account_json)
            cred = credentials.Certificate(service_account_info)
            firebase_admin.initialize_app(cred)
            print("✅ Firebase Admin SDK initialized from env variable")
            return admin_firestore.client()
        except Exception as e:
            print(f"❌ Firebase Admin init error (from env): {e}")
            return None

    # Option 2: Service account key file (for local development)
    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
    if not os.path.exists(service_account_path):
        print(f"⚠️  Firebase service account key not found at: {service_account_path}")
        print("   Push notifications will NOT work until you add the service account key.")
        print("   Download it from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key")
        return None
    try:
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin SDK initialized from file")
        return admin_firestore.client()
    except Exception as e:
        print(f"❌ Firebase Admin init error: {e}")
        return None


def send_expo_push(token: str, title: str, body: str, data: dict = None):
    """Send a push notification via Expo's free push service."""
    if not token or not token.startswith("ExponentPushToken["):
        return
    payload = {
        "to": token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {},
        "priority": "high",
        "channelId": "complaint-updates",
    }
    try:
        resp = http_requests.post(
            "https://exp.host/--/api/v2/push/send",
            json=payload,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        result = resp.json()
        if "errors" in result:
            print(f"Push error: {result['errors']}")
        else:
            print(f"✅ Push sent to {token[:30]}...")
    except Exception as e:
        print(f"Push send error: {e}")


def start_firestore_listeners(db):
    """Start background Firestore listeners for complaint status changes and deployments."""

    # Track complaint statuses to detect changes
    complaint_statuses: dict = {}  # key: "{userId}/{complaintKey}" -> last known status

    def on_users_snapshot(col_snapshot, changes, read_time):
        """Listen to ALL users' complaints for status changes → notify residents."""
        for change in changes:
            if change.type.name in ("ADDED", "MODIFIED"):
                doc = change.document
                data = doc.to_dict()
                status = (data.get("status") or "").lower()
                complaint_type = data.get("type", "complaint")

                # Extract userId from document path: users/{uid}/userComplaints/{key}
                path_parts = doc.reference.path.split("/")
                if len(path_parts) >= 4:
                    user_id = path_parts[1]
                    complaint_key = path_parts[3]
                else:
                    continue

                tracker_key = f"{user_id}/{complaint_key}"
                prev_status = complaint_statuses.get(tracker_key)
                complaint_statuses[tracker_key] = status

                # Skip initial load (no previous status)
                if prev_status is None:
                    continue

                # Only notify on actual status changes
                if prev_status == status:
                    continue

                # Get the user's push token
                try:
                    user_ref = db.collection("users").document(user_id)
                    user_doc = user_ref.get()
                    if not user_doc.exists:
                        continue
                    user_data = user_doc.to_dict()
                    push_token = user_data.get("expoPushToken")
                    if not push_token:
                        continue
                except Exception as e:
                    print(f"Error fetching user push token: {e}")
                    continue

                if status == "in progress" or status == "in-progress":
                    send_expo_push(
                        push_token,
                        "Complaint In Progress",
                        f"Your {complaint_type} complaint is now being handled by a tanod.",
                        {"screen": "complain", "complaintKey": complaint_key},
                    )
                elif status == "resolved":
                    send_expo_push(
                        push_token,
                        "Complaint Resolved",
                        f"Your {complaint_type} complaint has been resolved.",
                        {"screen": "complain", "complaintKey": complaint_key},
                    )

    # Track employee deployment statuses
    employee_deployment_status: dict = {}  # uid -> last known deploymentStatus

    def on_employee_snapshot(col_snapshot, changes, read_time):
        """Listen to employee documents for new deployments → notify tanods."""
        for change in changes:
            if change.type.name in ("ADDED", "MODIFIED"):
                doc = change.document
                data = doc.to_dict()
                uid = doc.id
                deployment_status = data.get("deploymentStatus", "available")
                deployed_to = data.get("deployedTo")

                prev = employee_deployment_status.get(uid)
                employee_deployment_status[uid] = deployment_status

                # Skip initial load
                if prev is None:
                    continue

                # Detect new deployment
                if prev != "deployed" and deployment_status == "deployed" and deployed_to:
                    push_token = data.get("expoPushToken")
                    if not push_token:
                        continue
                    complaint_type = deployed_to.get("type", "complaint")
                    purok = deployed_to.get("incidentPurok", "")
                    send_expo_push(
                        push_token,
                        "New Complaint Assigned",
                        f"You have been deployed to a {complaint_type} complaint in Purok {purok}.",
                        {"screen": "manage-requests", "complaintKey": deployed_to.get("complaintKey", "")},
                    )

    # Start listening to all users' complaints using collection group query
    print("🔔 Starting Firestore listeners for push notifications...")

    # Listen to all userComplaints across all users
    db.collection_group("userComplaints").on_snapshot(on_users_snapshot)
    print("   ✅ Listening to complaint status changes")

    # Listen to all employee documents
    db.collection("employee").on_snapshot(on_employee_snapshot)
    print("   ✅ Listening to employee deployment changes")


# ---------------------------
# Initialize Firebase Admin + Start Listeners (runs under both flask dev server and gunicorn)
# ---------------------------
_admin_db = init_firebase_admin()
if _admin_db:
    _listener_thread = threading.Thread(
        target=start_firestore_listeners,
        args=(_admin_db,),
        daemon=True,
    )
    _listener_thread.start()
else:
    print("⚠️  Running without push notifications (no service account key)")


# ---------------------------
# Run (only when running directly, not via gunicorn)
# ---------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
