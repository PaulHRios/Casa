#!/usr/bin/env bash
# Reconstruye los assets vendorizados (bundle 3D + pdf.js) y convierte los DXF a PDF.
# Uso:  bash scripts/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ Instalando dependencias de build…"
cd build
npm install --silent three@0.160.0 pdfjs-dist@3.11.174 esbuild@0.24.0
cd ..

echo "▶ Vendorizando pdf.js…"
mkdir -p vendor
cp build/node_modules/pdfjs-dist/build/pdf.min.js        vendor/pdf.min.js
cp build/node_modules/pdfjs-dist/build/pdf.worker.min.js vendor/pdf.worker.min.js

echo "▶ Empaquetando visor 3D (Three.js + addons)…"
ln -sf build/node_modules node_modules
build/node_modules/.bin/esbuild js/viewer3d.js \
  --bundle --format=esm --minify \
  --outfile=vendor/viewer3d.bundle.js
rm -f node_modules

echo "▶ Convirtiendo DXF → PDF (requiere: pip install ezdxf matplotlib)…"
python3 scripts/dxf_to_pdf.py || echo "  (omitido: instala ezdxf y matplotlib)"

echo "✔ Build completo."
