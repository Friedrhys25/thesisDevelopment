#!/bin/bash
# Build script for Render.com deployment
# This runs before the server starts

echo "🔧 Installing dependencies..."
pip install -r requirements.txt

echo "🤖 Training ML models..."
python train.py

echo "✅ Build complete!"
