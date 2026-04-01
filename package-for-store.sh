#!/bin/sh
# Run from repo root: ./package-for-store.sh
# Chrome Web Store requires manifest.json at the *root* of the zip (no extra folder).

set -e
cd "$(dirname "$0")"
rm -f chrome-store-upload.zip
zip -r chrome-store-upload.zip \
  manifest.json \
  background.js \
  content.js \
  popup.html \
  popup.js \
  popup.css \
  icons/
echo "Created chrome-store-upload.zip (manifest.json at zip root)"
unzip -l chrome-store-upload.zip | head -20
