Parche responsivo para PaulHRios/Casa

No pude hacer commit directo porque la integración de GitHub devolvió:
403 Resource not accessible by integration

Cambios incluidos:
1. index.html
   - Cambia viewport a viewport-fit=cover.
   - Agrega css/responsive.css después de css/style.css.

2. css/responsive.css
   - Safe areas para iPhone/iPad.
   - Layout adaptativo para vertical/horizontal.
   - Navbar con scroll horizontal en tabs.
   - Controles 3D reacomodados por orientación.
   - Galerías y lightbox mejorados para pantallas táctiles.
   - Planos responsivos con toolbar scrollable.

3. js/app.js
   - Corrige altura real en Safari móvil usando visualViewport.
   - Recalcula layout al cambiar orientación, pestañas o volver a la app.

4. js/planos.js
   - PDF se ajusta automáticamente al ancho disponible.
   - Re-render al rotar iPhone/iPad.
   - Evita renders simultáneos cancelando renderTask anterior.

Cómo aplicarlo:
- Copia estos archivos en la raíz del repo, respetando carpetas.
- Haz commit y push a la rama:
  claude/project-visualizer-3d-2d-vCVy2

Comandos sugeridos:
git checkout claude/project-visualizer-3d-2d-vCVy2
git add index.html css/responsive.css js/app.js js/planos.js
git commit -m "Improve responsive layout for iPhone and iPad"
git push
