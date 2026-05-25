# Proyecto Casa — Visualizador Interactivo

Visualizador de proyecto arquitectónico publicado en **GitHub Pages**.

## Secciones

| Sección | Descripción |
|---------|-------------|
| **Modelo 3D** | Visor interactivo con rotación, zoom y herramienta de medición |
| **Planos** | Visualizador de planos PDF con zoom y navegación de páginas |
| **Fotos** | Galería con lightbox |

## Cómo agregar archivos

### Modelos 3D
- Arrastra un archivo `.obj` o `.glb` directamente al visor
- O usa el botón **"Cargar OBJ"**

### Planos
- Coloca tus PDFs en `assets/drawings/`
- Actualiza `assets/drawings/manifest.json`:
  ```json
  ["planta-baja.pdf", "corte-a.pdf"]
  ```
- Los archivos `.dxf` deben exportarse a PDF desde tu programa CAD

### Fotos
- Coloca las fotos en `assets/photos/`
- Actualiza `assets/photos/manifest.json`:
  ```json
  ["foto1.jpg", "foto2.jpg"]
  ```

## GitHub Pages

El sitio se publica automáticamente desde la rama `gh-pages` o configurando Pages en Settings → Pages → Source: `main` / root.
