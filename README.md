## 3D Canvas

Retro software rendering experiment that projects a textured 3D object onto an HTML5 `<canvas>`, directly manipulating pixel buffers from TypeScript.  
GitHub Pages build: https://rogeralsing.github.io/3DCanvas/

### Structure
- `app.ts`  
  Entry point that loads `script/data.ts`, prepares the texture, spins the animation loop with `requestAnimationFrame`, and blits frames to the canvas.
- `script/data.ts`  
  Large ASCII export from 3ds Max containing geometry and normals for the spike model.
- `script/FileLoader.ts`  
  Parser that converts the ASCII model into typed structures (`Vertex`, `Mesh`, etc.) and associates the mesh with its material colours.
- `script/RenderEngine.ts`  
  Back-face culling, environment mapping coordinates, and a triangle rasterizer that steps scanlines into an `ImageData` buffer.
- `script/Structures.ts`  
  Shared geometry types and helpers (vector math, mesh, polygon definitions) used by the loader and renderer.

### Development
```bash
npm install
npm run build
npm run serve   # http://localhost:8080/index.html
```

Pushes to `master` run the Pages workflow under `.github/workflows/deploy-pages.yml`, rebuilding the TypeScript bundle and publishing the static site.***
