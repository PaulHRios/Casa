# Proyecto Casa — Visualizador Interactivo

Visualizador web del proyecto arquitectónico, publicado en **GitHub Pages**.
Todo el código corre 100 % en el navegador y las librerías están vendorizadas
(sin depender de CDNs externos).

## Secciones

| Sección | Descripción |
|---------|-------------|
| **Modelo 3D** | Visor interactivo del `.obj` (convertido a `.glb`): rotación, zoom, paneo, vistas predefinidas (Iso / Planta / Frente / Lado), modo malla y **herramienta de medición en metros**. |
| **Planos** | Los `.dxf` se convierten a **PDF vectorial** conservando líneas y cotas. Visor con zoom, ajuste y navegación de páginas. |
| **Fotos** | Galería con lightbox y navegación por teclado. |

## Estructura

```
index.html              página principal
css/style.css           estilos
js/app.js               navegación entre secciones
js/viewer3d.js          visor 3D (fuente; se empaqueta a vendor/)
js/planos.js            visor de planos PDF
js/fotos.js             galería
vendor/                 librerías vendorizadas (three+addons, pdf.js)
assets/models/          modelo .obj y .glb
assets/drawings/        planos PDF + manifest.json
assets/photos/          fotos + manifest.json
Archivos/               originales subidos (.obj, .dxf, fotos)
scripts/dxf_to_pdf.py   conversor DXF → PDF (ezdxf + matplotlib)
scripts/build.sh        reconstruye vendor/ y los PDF
```

## Agregar contenido

- **Modelo:** arrastra un `.obj`/`.glb` al visor, o reemplaza `assets/models/dibujo-3d.glb`.
- **Planos:** añade el PDF a `assets/drawings/` y al `manifest.json`. Para nuevos
  `.dxf`, ejecuta `python3 scripts/dxf_to_pdf.py` (ajusta la lista `JOBS`).
- **Fotos:** añade la imagen a `assets/photos/` y al `manifest.json`.

## Reconstruir los assets

```bash
pip install ezdxf matplotlib   # para convertir DXF
bash scripts/build.sh
```

## Publicar en GitHub Pages

En **Settings → Pages**, elige *Source: GitHub Actions*. El workflow
`.github/workflows/pages.yml` despliega automáticamente en cada push.
