# PROMPTS PARA FAL.AI

---

## 1. FRAMES KEY — Nano Banana 2 (fal.ai)

### Frame 1 — Inicio (solo un pedacito)

```
Pure black void. At the very bottom center, a tiny faint teal glow, barely visible. Just the smallest hint of the sacrum bone starting to materialize from the light, only the bottom edge visible, mostly darkness. Single vertical portrait frame, extreme minimal, pure black background, no text
```

### Frame final — Columna completa

```
Single complete human spine standing vertically centered in portrait frame on pure black background. Only one column visible, no other anatomy. All vertebrae from sacrum to skull fully assembled in bone-white with subsurface scattering. Glowing teal nerve fibers branching outward from every vertebral level. Pulsing crimson-red veins wrapping around the entire column. Amber-gold spinal cord glowing through the full vertebral canal. Volumetric glow, photorealistic, cinematic, no text no labels, pure black background
```

---

## 2. IMAGEN BASE — Nano Banana 2 (fal.ai)

### Prompt para imagen de referencia del estilo

```
Single human spine centered vertically in a narrow portrait composition, standing alone on pure black background. Only one spinal column visible, no other anatomy. Translucent bone-white vertebrae with subsurface scattering, glowing teal nerve fibers branching outward from each vertebral level, pulsing crimson-red veins wrapping around the column, amber-gold spinal cord visible inside the vertebral canal. Volumetric glow, cinematic depth of field, medical illustration quality, no text no labels, pure black background
```

### Imagen de referencia alternativa (más artística)

```
Single human spine centered vertically in portrait frame, standing alone on pure black background. Only one column visible, no other body parts. Bones in warm ivory with subsurface scattering, nervous system radiating as luminous teal fiber network, venous system as pulsing red mesh wrapping the spine, amber spinal cord glowing through the canal. Volumetric lighting, photorealistic, 8K, no text no UI
```

---

## 2. VIDEO — Kling 3.0 (fal.ai)

### Prompt principal (pegar directo en Kling)

```
Starts in complete black void, nothing visible. A single teal point of light appears at the bottom center and slowly the sacrum bone materializes from the glow, bone-white with subsurface scattering. Only one single spine column in the center of frame, vertical portrait orientation, no other anatomy visible. Then vertebra by vertebra the spine assembles upward from bottom to top — each bone-white vertebra fades in with a subtle glow, translucent discs appear between them. As the spine builds upward, a glowing amber spinal cord descends through the center, branching into teal nerve fibers at each level that pulse with electrical signals. Simultaneously, crimson-red veins weave around the spine pulsing with heartbeat rhythm, branching into capillaries around each vertebra. Progresses from sacrum to skull. Camera continuously orbits and rotates 360 degrees around the spine, circling the column as it assembles, revealing every angle of the vertebrae, nerves and veins. Final frame: one complete spine standing alone with teal nerves and red veins alive against pure black background after a full rotation. Photorealistic subsurface scattering, volumetric glow on nerves, caustic light on veins. No text no labels.
```

### Prompt alternativo (más corto, si Kling lo recorta)

```
Starts in pure black void. A teal light appears at bottom, then a single spine column assembles vertebra by vertebra upward from sacrum to skull, centered vertically in portrait frame, only one column visible. Amber spinal cord descends through center, teal nerve branches pulse outward, red veins wrap around pulsing with heartbeat. Camera continuously orbits 360 degrees around the spine, circling it as it builds. Photorealistic, volumetric glow, pure black background. No text.
```

### Settings recomendados Kling 3.0

```
Duration:    10s (máximo disponible)
Resolution:  1080p
Aspect:      9:16 (vertical para mobile-first landing)
Mode:        Standard o Professional (mejor calidad)
Negative:    text, labels, annotations, UI, watermark, cartoon, anime, low quality, blurry
Seed:        (dejar random, iterar hasta quedar satisfecho)
```

---

## 3. FFmpeg — Post-procesamiento

```bash
# Extraer frames del video generado
mkdir spine_frames
ffmpeg -i spine_video.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0F172A" -qscale:v 2 -start_number 0 spine_frames/frame_%05d.png

# Convertir a WebP para web
for f in spine_frames/*.png; do cwebp -q 85 "$f" -o "${f%.png}.webp"; done
```

---

## NOTAS

- Genera primero la imagen en Nano Banana 2 para validar el estilo visual
- Usa esa imagen como referencia/input para Kling 3.0 si permite image-to-video
- Si Kling no permite 9:16, genera en 16:9 y crop vertical después con FFmpeg
- Itera el prompt de Kling ajustando "teal" → "cyan" o "amber" → "gold" si los colores no coinciden con la marca
