# courseratest
Coursera Test repository
# My Project

This project uses the [Minimal Mistakes](https://github.com/mmistakes/minimal-mistakes) Jekyll theme for its design.

You can view the theme repository here: [Minimal Mistakes Theme](https://github.com/mmistakes/minimal-mistakes).

![Minimal Mistakes](https://repository-images.githubusercontent.com/75267304/7b09a780-952c-11e9-9f24-245f3977e52e)

## Trainer AI webapp (Netlify)

Se añadió una app React lista para despliegue en `webapp/` junto con `netlify.toml` en la raíz.

### Variables de entorno requeridas en Netlify
- `VITE_GEMINI_API_KEY` = tu API key de Gemini.

### Deploy automático en Netlify
1. Conecta este repositorio en Netlify ("Add new project" -> "Import from Git").
2. Netlify detectará `netlify.toml` y usará automáticamente:
   - Base directory: `webapp`
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
3. En **Site configuration -> Environment variables**, agrega `VITE_GEMINI_API_KEY`.
4. Dispara un nuevo deploy (o push a main) y quedará publicada.

> Nota: El repo principal sigue teniendo contenido Jekyll, pero el deploy de Netlify queda apuntado a la webapp React por `netlify.toml`.
