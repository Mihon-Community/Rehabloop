#!/bin/bash
set -u
cd "C:/Users/Administrator/Desktop/Rehabloop"
TARGET=674
MAX_WAIT=12600   # 3.5 hours
WAITED=0
INTERVAL=90

while true; do
  COUNT=$(find ml/data/raw/mobiphysio/videos -type f 2>/dev/null | wc -l)
  echo "$(date -u +%H:%M:%S) progress: $COUNT/$TARGET files"
  if [ "$COUNT" -ge "$TARGET" ]; then
    echo "download complete at $COUNT files"
    break
  fi
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo "TIMEOUT waiting for download after ${WAITED}s, only $COUNT/$TARGET files present. Not running extraction."
    exit 1
  fi
  sleep "$INTERVAL"
  WAITED=$((WAITED + INTERVAL))
done

echo "=== running extraction ==="
ml/.venv/Scripts/python.exe -I ml/src/pose_estimation/extract_dataset.py --workers 10
EXTRACT_RC=$?
echo "extraction exit code: $EXTRACT_RC"

echo "=== building manifest ==="
ml/.venv/Scripts/python.exe -I ml/src/datasets/build_manifest.py
MANIFEST_RC=$?
echo "manifest exit code: $MANIFEST_RC"

echo "PHASE1_PIPELINE_DONE extract_rc=$EXTRACT_RC manifest_rc=$MANIFEST_RC"
