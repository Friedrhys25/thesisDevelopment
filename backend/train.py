import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
import joblib

# === 1. Load and merge datasets ===
csv_files = [
    "combined_training_data_50_each_types.csv"
]

dfs = []
for file in csv_files:
    try:
        df = pd.read_csv(file)
        dfs.append(df)
        print(f"✅ Loaded: {file} ({len(df)} rows)")
    except Exception as e:
        print(f"⚠️ Skipped {file}: {e}")

# Combine all
df = pd.concat(dfs, ignore_index=True)
df = df.drop_duplicates(subset=["message"]).dropna(subset=["message", "label", "type"])
print(f"📊 Combined dataset size: {len(df)} rows")

# === 2. Clean text & labels ===
df["message"] = df["message"].astype(str).str.lower().str.strip()
df["label"] = df["label"].astype(str).str.lower().str.strip()
df["type"] = df["type"].astype(str).str.lower().str.strip()

# === 3. Features and targets ===
X = df["message"]
y_label = df["label"]
y_type = df["type"]

# === 4. Split dataset ===
X_train, X_test, y_label_train, y_label_test, y_type_train, y_type_test = train_test_split(
    X, y_label, y_type, test_size=0.2, random_state=42, stratify=y_label
)

# === 5. Build models ===
label_clf = Pipeline([
    ('tfidf', TfidfVectorizer(ngram_range=(1,2), min_df=2, sublinear_tf=True)),
    ('clf', LogisticRegression(max_iter=3000, class_weight="balanced", solver="liblinear"))
])

type_clf = Pipeline([
    ('tfidf', TfidfVectorizer(ngram_range=(1,2), min_df=2, sublinear_tf=True)),
    ('clf', LogisticRegression(max_iter=3000, class_weight="balanced", solver="liblinear"))
])

# === 6. Train models ===
print("\n🚀 Training label classifier (urgent vs non-urgent)...")
label_clf.fit(X_train, y_label_train)

print("🚀 Training type classifier (fire, medical, etc.)...")
type_clf.fit(X_train, y_type_train)

# === 7. Evaluate ===
print("\n📋 Label Classification Report")
print(classification_report(y_label_test, label_clf.predict(X_test)))

print("\n📋 Type Classification Report")
print(classification_report(y_type_test, type_clf.predict(X_test)))

# === 8. Save models ===
joblib.dump(label_clf, "label_model.pkl")
joblib.dump(type_clf, "type_model.pkl")

print("\n✅ Training complete! Models saved as:")
print(" - label_model.pkl")
print(" - type_model.pkl")