#!/bin/bash

# render-and-format.sh
# Script to render QMD to DOCX and apply post-processing formatting

set -e  # Exit on any error

QMD_FILE="TECHNICAL_PROGRESS_REPORT_JAN_2025_JULY_2025.qmd"
DOCX_FILE="TECHNICAL_PROGRESS_REPORT_JAN_2025_JULY_2025.docx"

echo "🔄 Rendering Quarto document to DOCX..."
quarto render "$QMD_FILE" --to docx

if [ -f "$DOCX_FILE" ]; then
    echo "✓ DOCX file generated successfully"
    
    echo "🔧 Applying paragraph formatting..."
    python3 format-docx.py "$DOCX_FILE"
    
    echo "✅ Document rendering and formatting complete!"
    echo "📄 Output: $DOCX_FILE"
else
    echo "❌ Error: DOCX file was not generated"
    exit 1
fi