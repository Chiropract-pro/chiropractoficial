// Genera las imágenes adicionales: 1 doctor deportiva + 4 jornadas paisajes
// + 3 avatares testimonios + 5 productos CRM = 13 totales

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY = process.env.FAL_KEY;
const LORA_URL = 'https://v3b.fal.media/files/b/0a983cf3/QShlwv20UzOfmjgUng2VL_pytorch_lora_weights.safetensors';

const PUB = path.join(__dirname, '..', 'public', 'images');
['dr-diaz', 'jornadas', 'testimonials', 'products'].forEach(d => {
  const p = path.join(PUB, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const COMMON = 'photorealistic, sharp focus, professional photography, soft natural lighting, 4k, high detail, color graded';
const NO_TEXT = 'no text, no logo, no writing, no labels, no watermark';

const PROMPTS = [
  // 1 — Doctor deportiva (con LoRA)
  {
    folder: 'dr-diaz',
    name: '13-deportiva',
    prompt: `Colombian male chiropractor in clean white medical coat (blank coat, ${NO_TEXT}) treating a young athlete in modern sports clinic, athlete sitting wearing sportswear, doctor focused on spine adjustment, motivational atmosphere, dynamic composition, ${COMMON}`,
    size: 'landscape_4_3',
    useLora: true,
  },

  // 4 — Jornadas paisajes (sin LoRA, son ambientes)
  {
    folder: 'jornadas',
    name: 'soata',
    prompt: `Colonial mountain town of Soatá Boyacá Colombia, traditional white adobe buildings with red clay tile roofs, cobblestone main square, distant green Andes mountains, golden afternoon light, peaceful Colombian rural atmosphere, ${NO_TEXT}, ${COMMON}`,
    size: 'landscape_16_9',
    useLora: false,
  },
  {
    folder: 'jornadas',
    name: 'guamal',
    prompt: `Small Colombian Andean town of Guamal in lush green rolling hills, traditional rural houses, palm trees, blue sky with scattered clouds, dirt road leading to town center, soft midday light, documentary photography, ${NO_TEXT}, ${COMMON}`,
    size: 'landscape_16_9',
    useLora: false,
  },
  {
    folder: 'jornadas',
    name: 'muzo',
    prompt: `Mining town of Muzo Boyacá Colombia famous for emeralds, mountain valley landscape, traditional Colombian architecture, river running through, lush tropical green vegetation, dramatic mountain backdrop, late afternoon, ${NO_TEXT}, ${COMMON}`,
    size: 'landscape_16_9',
    useLora: false,
  },
  {
    folder: 'jornadas',
    name: 'garces-navas',
    prompt: `Modern urban neighborhood of Bogotá Colombia, Garcés Navas area, residential apartment buildings, clean wide street with green trees, contemporary urban architecture, blue sky, daytime light, ${NO_TEXT}, ${COMMON}`,
    size: 'landscape_16_9',
    useLora: false,
  },

  // 3 — Avatares testimonios (sin LoRA, pacientes genéricos)
  {
    folder: 'testimonials',
    name: 'catalina-forero',
    prompt: `Professional headshot of a Colombian woman in her late 30s, warm friendly smile, casual professional clothing, neutral office background, natural soft lighting, friendly approachable expression, ${NO_TEXT}, ${COMMON}`,
    size: 'square_hd',
    useLora: false,
  },
  {
    folder: 'testimonials',
    name: 'jairo-rodriguez',
    prompt: `Professional headshot of a Colombian man in his 50s, kind warm expression, casual button-up shirt, simple background, natural lighting, looking trustworthy and friendly, slight gray hair, ${NO_TEXT}, ${COMMON}`,
    size: 'square_hd',
    useLora: false,
  },
  {
    folder: 'testimonials',
    name: 'ana-maria-lopez',
    prompt: `Professional headshot of a young Colombian woman in her late 20s, athletic build, sportive casual clothing, confident healthy expression, soft outdoor lighting with greenery in background, looking strong and recovered, ${NO_TEXT}, ${COMMON}`,
    size: 'square_hd',
    useLora: false,
  },

  // 5 — Productos CRM (sin LoRA, product photography)
  {
    folder: 'products',
    name: 'almohada-cervical',
    prompt: `Product photography of an ergonomic cervical orthopedic memory foam pillow on clean white background, contoured shape for neck support, professional commerce photography, soft shadow, top-down angle, clean and minimal, ${NO_TEXT}, ${COMMON}`,
    size: 'square_hd',
    useLora: false,
  },
  {
    folder: 'products',
    name: 'cinturon-lumbar',
    prompt: `Product photography of a black lumbar support belt with ergonomic design and adjustable straps, displayed on clean white background, professional commerce photography, soft shadow, ${NO_TEXT}, ${COMMON}`,
    size: 'square_hd',
    useLora: false,
  },
  {
    folder: 'products',
    name: 'suplemento-magnesio',
    prompt: `Product photography of a small white plastic supplement bottle with simple unbranded label containing magnesium capsules, displayed on clean white background, professional commerce photography, ${NO_TEXT}, ${COMMON}`,
    size: 'square_hd',
    useLora: false,
  },
  {
    folder: 'products',
    name: 'soporte-cervical',
    prompt: `Product photography of a soft gray travel neck pillow / cervical support, U-shape memory foam, displayed on clean white background, professional commerce photography, soft shadow, ${NO_TEXT}, ${COMMON}`,
    size: 'square_hd',
    useLora: false,
  },
  {
    folder: 'products',
    name: 'pelota-miofascial',
    prompt: `Product photography of a small dense lacrosse-style massage ball for myofascial release in dark teal color, single ball on clean white background, professional commerce photography, soft shadow, ${NO_TEXT}, ${COMMON}`,
    size: 'square_hd',
    useLora: false,
  },
];

async function generate(p) {
  console.log(`\n[${p.folder}/${p.name}]`);
  const body = {
    prompt: p.prompt,
    image_size: p.size,
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    enable_safety_checker: false,
  };
  if (p.useLora) body.loras = [{ path: LORA_URL, scale: 1.0 }];

  const submitR = await fetch('https://queue.fal.run/fal-ai/flux-lora', {
    method: 'POST',
    headers: { Authorization: 'Key ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const submitted = await submitR.json();
  if (!submitted.request_id) {
    console.log('  ❌ Submit failed:', submitted);
    return null;
  }

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const s = await fetch(submitted.status_url, { headers: { Authorization: 'Key ' + KEY } });
    const status = await s.json();
    process.stdout.write('.');
    if (status.status === 'COMPLETED') {
      const r2 = await fetch(submitted.response_url, { headers: { Authorization: 'Key ' + KEY } });
      const final = await r2.json();
      const url = final.images?.[0]?.url;
      if (!url) { console.log('\n  ❌ No URL'); return null; }
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      const filePath = path.join(PUB, p.folder, p.name + '.jpg');
      fs.writeFileSync(filePath, buf);
      console.log(`\n  ✅ ${(buf.length / 1024).toFixed(0)} KB → ${p.folder}/${p.name}.jpg`);
      return { folder: p.folder, name: p.name, file: filePath };
    }
    if (status.status === 'FAILED' || status.status === 'ERROR') {
      console.log('\n  ❌ Failed'); return null;
    }
  }
  return null;
}

(async () => {
  console.log(`Generando ${PROMPTS.length} imágenes adicionales...`);
  const ok = [];
  for (const p of PROMPTS) {
    const r = await generate(p);
    if (r) ok.push(r);
  }
  console.log(`\n\n✅ ${ok.length}/${PROMPTS.length} generadas`);
  console.log(`Costo: ~$${(ok.length * 0.05).toFixed(2)} USD`);
})();
