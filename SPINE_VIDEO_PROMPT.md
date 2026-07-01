# PROMPT 1 — GENERACIÓN DE VIDEO COLUMNA VERTEBRAL (Frame Extraction)

## Objetivo

Crear un video cinematográfico de la columna vertebral humana que se ensambla progresivamente junto con el sistema nervioso y el sistema venoso, para ser extraído frame por frame con FFmpeg y usado como animación scroll-driven en la landing page de chiropract.co.

---

## Especificaciones del video

### Formato técnico

```
Resolución:    1920x1080 (vertical crop a 1080x1920 después)
FPS:           60fps (suavidad máxima para scroll)
Duración:      10 segundos (600 frames)
Codec:         ProRes 4444 o H.265 (alta calidad)
Alpha:         Canal alpha para compositing (fondo transparente)
Color space:   sRGB
Bit depth:     10-bit mínimo
```

### Paleta de colores del video

```
Hueso / Vértebras:       #E8DCC8 → #D4C4A8 (marfil cálido, sutile orgánico)
Sistema Nervioso:        #14B8A6 → #0F766E (teal — brand color de chiropract.co)
Sistema Venoso:          #EF4444 → #DC2626 (rojo vivo, pulsante)
Discos intervertebrales: #C4B5A0 → #A89880 (beige translúcido)
Médula espinal:          #FBBF24 → #F59E0B (ámbar — brand accent)
Luz ambiente:            #0F172A fondo oscuro (slate-900)
Glow nervous:            #5EEAD4 (teal-300 glow)
Glow venous:             #FCA5A5 (red-300 glow)
```

---

## Prompt para generación AI (Sora / Runway / Kling / Pika)

### Versión en inglés (mejor resultado en modelos AI)

```
Cinematic medical animation, photorealistic 3D render of a human spine assembling
vertabra by vertebra from bottom to top (sacrum to C1 atlas), starting from
complete darkness. Each vertebra materializes with a subtle bone-white glow,
followed immediately by the intervertebral disc appearing as a translucent
cushion between them. As the spine builds upward, the spinal cord descends
through the vertebral foramen as a glowing amber-gold thread of light,
branching into nerve roots at each vertebral level — the nerves spread outward
like luminous teal-green fibers, pulsing softly with electrical signals.
Simultaneously, the venous system weaves around the spine — red-crimson veins
that pulse with a subtle heartbeat rhythm, branching into smaller capillaries
that wrap around each vertebra like a living mesh. The animation progresses
from sacrum to skull, completing the full spinal column with the nervous system
radiating outward and the venous network pulsing around it. The final frame
shows the complete spine standing tall with nerves glowing teal and veins
pulsing red against a dark slate background. Photorealistic subsurface
scattering on bone, volumetric glow on nerves, caustic light on veins.
Camera: slow upward dolly following the assembly. Medical illustration quality.
8K detail, cinematic depth of field, no text, no labels, no UI.
```

### Versión extendida (más control)

```
Frame-by-frame spine assembly animation:

SECOND 1-2: Darkness. A single point of teal light appears at the bottom center.
The sacrum (S1-S5) materializes from the light, bone-white with subsurface
scattering, warm ivory tones. The sacral nerves emerge as thin teal fibers
glowing outward.

SECOND 2-3: Lumbar vertebrae (L5-L1) stack upward one by one with a subtle
click-into-place motion. Each disc appears as a translucent gel-like cushion.
The lumbar nerves branch outward with increasing complexity, teal glow
pulsing. The inferior vena cava begins forming as a red pulsing vessel
running alongside.

SECOND 3-5: Thoracic vertebrae (T12-T1) assemble faster. The spinal cord
becomes visible inside the canal as a continuous amber-gold thread. Nerve
roots at each level fan out like tree branches, teal fibers reaching
laterally. The venous network grows denser — veins wrapping around each
vertebra, pulsing red with a visible heartbeat rhythm (1 pulse per second).
Intercostal veins spread like a mesh.

SECOND 5-7: Cervical vertebrae (C7-C1) assemble with delicate precision,
smaller and more refined. The vertebral arteries appear as paired red vessels
ascending alongside. The nerve plexus becomes intricate, teal fibers
spreading like a neural network visualization. The spinal cord thickens
slightly approaching the foramen magnum.

SECOND 7-8: The atlas (C1) and axis (C2) click into place at the top.
The spinal cord enters the skull base — a subtle amber glow emanates from
the foramen magnum upward. The entire nervous system is now visible as a
teal luminous tree growing from the spine. The venous system is a complete
red pulsing mesh wrapping the column.

SECOND 8-10: Hold on the complete assembly. Camera slowly pulls back.
The spine stands illuminated against dark slate (#0F172A). Nerves pulse
teal (#14B8A6) with electrical signals traveling along them. Veins pulse
red (#EF4444) in heartbeat rhythm. The amber spinal cord glows steadily
(#F59E0B). Subtle particle effects — small light motes drifting upward
along the spine. Final frame: full spine centered, glowing, alive.

Technical: Photorealistic 3D, subsurface scattering on bone, volumetric
light emission on nerves, caustic reflections on veins, cinematic depth
of field, dark background, 60fps, no text no labels no UI.
```

---

## Comando FFmpeg para extracción de frames

```bash
# Crear carpeta de frames
mkdir -p spine_frames

# Extraer todos los frames como PNG con alpha
ffmpeg -i spine_video.mov \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black@0" \
  -qscale:v 2 \
  -start_number 0 \
  spine_frames/frame_%05d.png

# Resultado: 600 frames (10 seg × 60fps)
# frame_00000.png → frame_00599.png

# Si el video no tiene alpha, crear máscara (fondo oscuro → transparente)
ffmpeg -i spine_video.mov \
  -vf "scale=1080:1920,chromakey=0x0F172A:0.1:0.2" \
  -c:v png \
  -start_number 0 \
  spine_frames_alpha/frame_%05d.png
```

### Optimización para web (reducir peso)

```bash
# Convertir frames a WebP (80% menor peso)
for f in spine_frames/*.png; do
  cwebp -q 85 "$f" -o "${f%.png}.webp"
done

# O generar sprite sheet para cargar 1 sola imagen
montage spine_frames/*.png -tile 30x -geometry 1080x1920+0+0 spine_sprite.jpg
```

---

## Estructura de frames para scroll-driven

```
spine_frames/
├── frame_00000.png  ← scroll 0%   (oscuridad total)
├── frame_00030.png  ← scroll 5%   (sacrum aparece)
├── frame_00060.png  ← scroll 10%  (L5 aparece)
├── frame_00120.png  ← scroll 20%  (lumbar completo)
├── frame_00180.png  ← scroll 30%  (torácica baja)
├── frame_00240.png  ← scroll 40%  (torácica media)
├── frame_00300.png  ← scroll 50%  (torácica alta)
├── frame_00360.png  ← scroll 60%  (cervical baja)
├── frame_00420.png  ← scroll 70%  (cervical alta)
├── frame_00480.png  ← scroll 80%  (atlas/axis)
├── frame_00540.png  ← scroll 90%  (ensamblaje completo)
└── frame_00599.png  ← scroll 100% (hold final, glow)
```

Mapeo: `frameIndex = Math.floor(scrollProgress × 599)`

---
---

# PROMPT 2 — LANDING PAGE SCROLL-DRIVEN CON COLUMNA VERTEBRAL

## Objetivo

Construir la landing page de chiropract.co con una experiencia scroll-driven cinematográfica donde la columna vertebral se ensambla conforme el usuario hace scroll, revelando el sistema nervioso y venoso, mientras el contenido de la landing aparece sincronizado con cada sección de la columna.

---

## Stack

```
Framework:     Next.js 15 (App Router) + React 19
Styling:       TailwindCSS v4
Animation:     Framer Motion 12 + CSS Scroll-Driven Animations API
Components:    21st.dev (shadcn/ui premium) + UX UI Pro Max
3D/Canvas:     HTML5 Canvas para frame rendering (no Three.js — más performante)
Video:         FFmpeg-extracted frames (600 PNGs → Canvas)
Fonts:         Inter (body) + Playfair Display (headings)
Icons:         Lucide React
Deploy:        Vercel
```

---

## Arquitectura de la landing

```
chiropract.co/
├── app/
│   ├── layout.tsx              ← Root layout + fonts + metadata
│   ├── page.tsx                ← Landing page (scroll container)
│   ├── globals.css             ← TailwindCSS + scroll-driven keyframes
│   └── api/
│       └── contact/route.ts    ← Form submission endpoint
├── components/
│   ├── SpineCanvas.tsx         ← Canvas render de frames por scroll
│   ├── HeroSection.tsx         ← Sección hero con CTA
│   ├── AboutSection.tsx        ← Sobre el doctor
│   ├── ServicesSection.tsx     ← Servicios quiroprácticos
│   ├── JornadasSection.tsx     ← Jornadas itinerantes
│   ├── TestimonialsSection.tsx ← Testimonios
│   ├── ContactSection.tsx      ← Formulario de contacto
│   ├── Navbar.tsx              ← Navegación sticky
│   ├── WhatsAppFAB.tsx         ← Botón flotante WhatsApp
│   └── ui/                     ← Componentes 21st.dev / UX UI Pro Max
├── public/
│   └── spine_frames/           ← 600 frames extraídos
├── hooks/
│   └── useScrollProgress.ts    ← Hook de progreso de scroll
└── lib/
    └── utils.ts                ← Helpers
```

---

## Componente core: SpineCanvas.tsx

```tsx
"use client";

import { useRef, useEffect, useState, useCallback } from "react";

const TOTAL_FRAMES = 600;
const FRAME_PATH = "/spine_frames/frame_";

export default function SpineCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const currentFrameRef = useRef(0);

  // Precargar frames (estrategia: cargar cada 5to frame primero, luego llenar)
  useEffect(() => {
    let loadedCount = 0;
    const priorityFrames = Array.from({ length: TOTAL_FRAMES }, (_, i) => i)
      .filter((_, i) => i % 5 === 0); // 120 frames prioritarios

    const loadFrame = (index: number): Promise<void> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = `${FRAME_PATH}${String(index).padStart(5, "0")}.webp`;
        img.onload = () => {
          framesRef.current[index] = img;
          loadedCount++;
          resolve();
        };
        img.onerror = () => resolve();
      });
    };

    // Cargar frames prioritarios primero
    Promise.all(priorityFrames.map(loadFrame)).then(() => {
      setLoaded(true);
      // Luego cargar el resto en background
      const remaining = Array.from({ length: TOTAL_FRAMES }, (_, i) => i)
        .filter((i) => !framesRef.current[i]);
      remaining.forEach((i) => loadFrame(i));
    });
  }, []);

  // Renderizar frame en canvas
  const renderFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = framesRef.current[frameIndex];
    if (!canvas || !ctx || !img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    currentFrameRef.current = frameIndex;
  }, []);

  // Escuchar scroll y mapear a frame
  useEffect(() => {
    if (!loaded) return;

    const handleScroll = () => {
      const scrollHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = window.scrollY / scrollHeight;
      const frameIndex = Math.min(
        Math.floor(scrollProgress * (TOTAL_FRAMES - 1)),
        TOTAL_FRAMES - 1
      );

      if (frameIndex !== currentFrameRef.current) {
        requestAnimationFrame(() => renderFrame(frameIndex));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loaded, renderFrame]);

  // Frame inicial
  useEffect(() => {
    if (loaded) renderFrame(0);
  }, [loaded, renderFrame]);

  return (
    <canvas
      ref={canvasRef}
      width={1080}
      height={1920}
      className="fixed inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-90"
      style={{ imageRendering: "auto" }}
    />
  );
}
```

---

## Hook: useScrollProgress.ts

```tsx
"use client";

import { useState, useEffect } from "react";

export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollHeight > 0 ? window.scrollY / scrollHeight : 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return progress; // 0.0 → 1.0
}
```

---

## Layout de la landing page

### Secciones sincronizadas con la columna

| Scroll % | Zona espinal | Sección landing | Contenido |
|----------|-------------|----------------|-----------|
| 0-5% | Oscuridad → Sacro | **Hero** | "Tu bienestar empieza con una buena alineación" + CTA |
| 5-20% | Lumbar (L5-L1) | **Problema** | "El dolor de espalda afecta al 80% de las personas" + stats |
| 20-50% | Torácica (T12-T1) | **Servicios** | Cards de servicios quiroprácticos (6 cards) |
| 50-70% | Cervical (C7-C1) | **Sobre el Dr.** | Foto + credenciales + enfoque |
| 70-85% | Atlas + nervios | **Jornadas** | Mapa + próximas jornadas + CTA |
| 85-95% | Sistema completo | **Testimonios** | Carrusel de testimonios |
| 95-100% | Glow final | **Contacto** | Formulario + WhatsApp + dirección |

---

## Page.tsx — Estructura completa

```tsx
"use client";

import { motion } from "framer-motion";
import SpineCanvas from "@/components/SpineCanvas";
import HeroSection from "@/components/HeroSection";
import ProblemSection from "@/components/ProblemSection";
import ServicesSection from "@/components/ServicesSection";
import AboutSection from "@/components/AboutSection";
import JornadasSection from "@/components/JornadasSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import ContactSection from "@/components/ContactSection";
import Navbar from "@/components/Navbar";
import WhatsAppFAB from "@/components/WhatsAppFAB";

export default function LandingPage() {
  return (
    <main className="relative bg-[#0F172A] text-white overflow-x-hidden">
      {/* Canvas fijo con frames de la columna */}
      <SpineCanvas />

      {/* Navbar sticky transparente */}
      <Navbar />

      {/* Contenido scrolleable sobre el canvas */}
      <div className="relative z-10">

        {/* HERO — scroll 0-5% */}
        <section className="min-h-screen flex items-center justify-center">
          <HeroSection />
        </section>

        {/* PROBLEMA — scroll 5-20% */}
        <section className="min-h-screen flex items-center">
          <ProblemSection />
        </section>

        {/* SERVICIOS — scroll 20-50% */}
        <section className="min-h-[200vh] flex items-center">
          <ServicesSection />
        </section>

        {/* SOBRE EL DR. — scroll 50-70% */}
        <section className="min-h-screen flex items-center">
          <AboutSection />
        </section>

        {/* JORNADAS — scroll 70-85% */}
        <section className="min-h-screen flex items-center">
          <JornadasSection />
        </section>

        {/* TESTIMONIOS — scroll 85-95% */}
        <section className="min-h-screen flex items-center">
          <TestimonialsSection />
        </section>

        {/* CONTACTO — scroll 95-100% */}
        <section className="min-h-screen flex items-center">
          <ContactSection />
        </section>

      </div>

      {/* WhatsApp flotante */}
      <WhatsAppFAB />
    </main>
  );
}
```

---

## Animaciones Framer Motion por sección

### HeroSection.tsx

```tsx
"use client";

import { motion, useScrollProgress } from "framer-motion";
import { useScrollProgress as useCustomScroll } from "@/hooks/useScrollProgress";

export default function HeroSection() {
  const progress = useCustomScroll();

  return (
    <div className="max-w-4xl mx-auto text-center px-6">
      {/* Título con reveal progresivo */}
      <motion.h1
        className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight"
        style={{ opacity: Math.max(0, 1 - progress * 10) }} // fade out rápido
      >
        <span className="text-white">Tu bienestar</span>
        <br />
        <span className="bg-gradient-to-r from-teal-400 to-amber-400 bg-clip-text text-transparent">
          empieza aquí
        </span>
      </motion.h1>

      {/* Subtítulo */}
      <motion.p
        className="text-lg md:text-xl text-slate-300 mt-6 max-w-2xl mx-auto"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        viewport={{ once: true }}
      >
        Quiropraxia profesional en Bogotá y jornadas en Boyacá.
        Alinea tu cuerpo. Transforma tu vida.
      </motion.p>

      {/* CTA */}
      <motion.div
        className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.6 }}
        viewport={{ once: true }}
      >
        <a
          href="https://wa.me/573112345678?text=Hola%2C%20quiero%20agendar%20una%20consulta"
          className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-4 rounded-full text-lg font-semibold transition-colors shadow-lg shadow-teal-600/30"
        >
          Agenda tu primera consulta
        </a>
        <a
          href="#servicios"
          className="border border-white/20 hover:bg-white/10 text-white px-8 py-4 rounded-full text-lg font-semibold transition-colors"
        >
          Conoce más
        </a>
      </motion.div>

      {/* Indicador de scroll */}
      <motion.div
        className="mt-20"
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <svg className="w-6 h-6 mx-auto text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </motion.div>
    </div>
  );
}
```

### ServicesSection.tsx — Cards con reveal secuencial

```tsx
"use client";

import { motion } from "framer-motion";

const services = [
  {
    title: "Ajuste Quiropráctico",
    desc: "Corrección de subluxaciones vertebrales con técnica precisa y segura",
    icon: "🦴",
    color: "from-teal-500/20 to-teal-900/20",
  },
  {
    title: "Terapia Cervical",
    desc: "Alivio del dolor cervical, cefaleas y mareos por disfunción cervical",
    icon: "🧠",
    color: "from-amber-500/20 to-amber-900/20",
  },
  {
    title: "Terapia Lumbar",
    desc: "Tratamiento de lumbalgia, ciática y hernias discales",
    icon: "⚡",
    color: "from-red-500/20 to-red-900/20",
  },
  {
    title: "Quiropraxia Deportiva",
    desc: "Optimización del rendimiento y prevención de lesiones deportivas",
    icon: "🏃",
    color: "from-green-500/20 to-green-900/20",
  },
  {
    title: "Rehabilitación Postural",
    desc: "Corrección de alteraciones posturales y síndrome de dolor crónico",
    icon: "🧘",
    color: "from-purple-500/20 to-purple-900/20",
  },
  {
    title: "Jornadas Itinerantes",
    desc: "Atención quiropráctica en Soatá, Guamal, Muzo y Garcés Navas",
    icon: "🚗",
    color: "from-blue-500/20 to-blue-900/20",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 60, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export default function ServicesSection() {
  return (
    <div className="max-w-6xl mx-auto px-6 w-full">
      <motion.h2
        className="text-4xl md:text-5xl font-bold text-center mb-4"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true, margin: "-100px" }}
      >
        Especialidades
      </motion.h2>
      <motion.p
        className="text-slate-400 text-center mb-12 max-w-2xl mx-auto"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        viewport={{ once: true }}
      >
        Tratamientos diseñados para restaurar la función de tu cuerpo
      </motion.p>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
      >
        {services.map((service) => (
          <motion.div
            key={service.title}
            variants={cardVariants}
            className={`bg-gradient-to-br ${service.color} backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 group cursor-pointer`}
            whileHover={{ y: -4, scale: 1.02 }}
          >
            <span className="text-4xl mb-4 block">{service.icon}</span>
            <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-teal-300 transition-colors">
              {service.title}
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">{service.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
```

---

## Estilos globales (globals.css)

```css
@import "tailwindcss";

@theme {
  --color-primary: #0f766e;
  --color-primary-light: #14b8a6;
  --color-accent: #f59e0b;
  --color-danger: #ef4444;
  --color-dark: #0f172a;
}

/* Scroll suave */
html {
  scroll-behavior: smooth;
}

/* Scrollbar personalizado */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: #0f172a;
}
::-webkit-scrollbar-thumb {
  background: #14b8a6;
  border-radius: 3px;
}

/* Glow effects */
.glow-teal {
  box-shadow: 0 0 40px rgba(20, 184, 166, 0.3), 0 0 80px rgba(20, 184, 166, 0.1);
}
.glow-amber {
  box-shadow: 0 0 40px rgba(245, 158, 11, 0.3), 0 0 80px rgba(245, 158, 11, 0.1);
}
.glow-red {
  box-shadow: 0 0 40px rgba(239, 68, 68, 0.2), 0 0 80px rgba(239, 68, 68, 0.1);
}

/* Text glow */
.text-glow-teal {
  text-shadow: 0 0 20px rgba(20, 184, 166, 0.5), 0 0 40px rgba(20, 184, 166, 0.2);
}
.text-glow-amber {
  text-shadow: 0 0 20px rgba(245, 158, 11, 0.5), 0 0 40px rgba(245, 158, 11, 0.2);
}

/* Glassmorphism */
.glass {
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.glass-light {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Pulse animation for veins effect */
@keyframes pulse-vein {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
.animate-pulse-vein {
  animation: pulse-vein 1s ease-in-out infinite;
}

/* Neural signal animation */
@keyframes neural-signal {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
.animate-neural {
  background: linear-gradient(90deg, transparent, #14b8a6, transparent);
  background-size: 200% 100%;
  animation: neural-signal 2s linear infinite;
}
```

---

## Componentes UX UI Pro Max a usar

De https://ui-ux-pro-max-skill.nextlevelbuilder.io/:

1. **MagneticButton** — CTA principal que sigue al cursor sutilmente
2. **SpotlightCard** — Cards de servicios con efecto spotlight al hover
3. **AnimatedText** — Texto con reveal por carácter/palabra
4. **ParallaxSection** — Secciones con parallax suave
5. **GlowBorder** — Bordes con glow animado
6. **MorphingDialog** — Modal para formulario de contacto
7. **InfiniteSlider** — Slider de testimonios infinito
8. **CountUp** — Números animados (stats)
9. **ScrollProgress** — Barra de progreso de scroll en la navbar
10. **ParticleField** — Campo de partículas subtle en hero

---

## Componentes 21st.dev a usar

1. **Button** — Variantes primary/ghost/danger
2. **Card** — Con glassmorphism
3. **Dialog** — Formulario de agendamiento
4. **Input / Textarea** — Formulario de contacto
5. **Badge** — Tags de servicios
6. **Avatar** — Foto del doctor
7. **Separator** — Divisores entre secciones
8. **Tooltip** — Info sobre vértebras al hover

---

## Navbar.tsx — Sticky con scroll progress

```tsx
"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { label: "Inicio", href: "#hero" },
  { label: "Servicios", href: "#servicios" },
  { label: "Dr. Díaz", href: "#about" },
  { label: "Jornadas", href: "#jornadas" },
  { label: "Contacto", href: "#contacto" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { scrollYProgress } = useScroll();

  return (
    <>
      {/* Barra de progreso */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-500 via-amber-500 to-red-500 z-50 origin-left"
        style={{ scaleX: scrollYProgress }}
      />

      <nav className="fixed top-0 left-0 right-0 z-40 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="#" className="text-xl font-bold">
            <span className="text-teal-400">chiro</span>
            <span className="text-white">pract</span>
            <span className="text-slate-400">.co</span>
          </a>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-slate-300 hover:text-teal-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://wa.me/573112345678"
              className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors"
            >
              Agendar cita
            </a>
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden text-white" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <motion.div
            className="md:hidden glass border-t border-white/10 px-6 py-4 space-y-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block text-slate-300 hover:text-teal-400 py-2"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </motion.div>
        )}
      </nav>
    </>
  );
}
```

---

## WhatsAppFAB.tsx — Botón flotante

```tsx
"use client";

import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

export default function WhatsAppFAB() {
  return (
    <motion.a
      href="https://wa.me/573112345678?text=Hola%2C%20quiero%20información%20sobre%20quiropraxia"
      target="_blank"
      className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-400 text-white p-4 rounded-full shadow-lg shadow-green-500/30 transition-colors"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 2, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <MessageCircle size={24} />
    </motion.a>
  );
}
```

---

## Performance optimization

1. **Lazy loading de frames:** Cargar solo los frames visibles ± 30 frames
2. **WebP:** Todos los frames en WebP quality 85
3. **Canvas:** Usar `willReadFrequently: false` y `imageSmoothingEnabled: true`
4. **requestAnimationFrame:** Throttle de render a 60fps max
5. **Intersection Observer:** Solo renderizar canvas cuando está en viewport
6. **Preload:** `<link rel="preload">` para los primeros 30 frames
7. **CDN:** Frames servidos desde Vercel CDN con cache headers
8. **Mobile:** En mobile, usar cada 3er frame (200 frames total) para reducir carga

---

## SEO y metadata

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: "chiropract.co — Quiropraxia Profesional en Bogotá | Dr. Miguel Ángel Díaz",
  description: "Quiropraxia profesional en Bogotá y jornadas itinerantes en Boyacá. Ajuste quiropráctico, terapia cervical, lumbar y deportiva. Agenda tu consulta hoy.",
  keywords: ["quiropraxia", "quiropráctico", "Bogotá", "Boyacá", "dolor de espalda", "columna vertebral", "Dr. Díaz"],
  openGraph: {
    title: "chiropract.co — Quiropraxia Profesional",
    description: "Alinea tu cuerpo. Transforma tu vida.",
    url: "https://chiropract.co",
    siteName: "chiropract.co",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
    locale: "es_CO",
    type: "website",
  },
};
```
