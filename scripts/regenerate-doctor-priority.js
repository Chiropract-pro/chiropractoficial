// Regenera SOLO las 9 fotos críticas del doctor que están en uso en la landing.
// Ajustes:
//  - "athletic build, fit physique, lean strong" → más parecido al real
//  - Sin bata blanca cuando se pueda (camisa azul, polo) → cero riesgo de logo random
//  - Para las que SI necesitan bata: "completely blank, no text no symbols no logos no embroidery"

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY = process.env.FAL_KEY;
const LORA_URL = 'https://v3b.fal.media/files/b/0a983cf3/QShlwv20UzOfmjgUng2VL_pytorch_lora_weights.safetensors';
const OUT = path.join(__dirname, '..', 'public', 'images', 'dr-diaz');

// NO describir composición corporal — el LoRA aprendió al doctor real, dejarlo libre
const NO_LOGO = 'absolutely no logos, no text, no embroidery, no writing, no symbols, no badges, no monogram, plain uniform fabric';
const COMMON = 'photorealistic, sharp focus on face, professional photography, soft natural lighting, 4k, color graded, well-groomed beard';

// Para evitar logos: cuando sea posible, sin bata blanca.
// Cuando sí lleva bata, especificar "completely blank, plain white".
const PROMPTS = [
  {
    name: '01-portrait-formal',
    prompt: `Professional portrait of Colombian male chiropractor, wearing a clean light blue button-up dress shirt (no coat, ${NO_LOGO}), warm friendly expression, slight smile, neutral medical clinic background slightly blurred, looking confident and professional, ${COMMON}`,
    size: 'portrait_4_3',
  },
  {
    name: '02-examining-patient',
    prompt: `Colombian male chiropractor, wearing dark navy clinical scrubs (no coat, ${NO_LOGO}), examining a patient lying on a treatment table, hands gently positioned on patient's spine, focused professional expression, modern bright clinic, soft natural light, ${COMMON}`,
    size: 'landscape_4_3',
  },
  {
    name: '03-jornada-rural',
    prompt: `Colombian male chiropractor, wearing a casual light gray polo shirt (${NO_LOGO}), attending an elderly patient in a small rural Andean town clinic in Boyacá Colombia, simple wooden interior, warm afternoon light, kind compassionate expression, documentary photography, ${COMMON}`,
    size: 'landscape_4_3',
  },
  {
    name: '04-charla-educativa',
    prompt: `Colombian male chiropractor, wearing a smart casual light blue shirt (${NO_LOGO}), giving an educational talk in a modern conference room, gesturing while explaining spine anatomy, confident posture, professional environment, audience listening, ${COMMON}`,
    size: 'portrait_4_3',
  },
  {
    name: '06-instruments-diagnostic',
    prompt: `Colombian male chiropractor, wearing dark blue medical scrubs (${NO_LOGO}), reviewing a spinal X-ray on a backlit lightbox, focused concentrated expression, modern clinical setting, dramatic side lighting on the X-ray illuminating his face, ${COMMON}`,
    size: 'landscape_4_3',
  },
  {
    name: '07-portrait-hero',
    prompt: `Confident editorial portrait of Colombian male chiropractor, wearing a clean fitted light blue dress shirt (no coat, ${NO_LOGO}), arms slightly crossed, looking directly at camera with warm authoritative gaze, modern minimalist clinic background slightly blurred, premium magazine style, ${COMMON}`,
    size: 'portrait_4_3',
  },
  {
    name: '08-with-patient-talking',
    prompt: `Colombian male chiropractor, wearing dark navy scrubs (${NO_LOGO}), sitting and talking attentively with a middle-aged female patient, taking notes on a clipboard, warm consultation environment, natural conversation, both people visible at three-quarter angle, ${COMMON}`,
    size: 'landscape_4_3',
  },
  {
    name: '12-checking-posture',
    prompt: `Colombian male chiropractor, wearing dark blue clinical scrubs (${NO_LOGO}), checking the posture of a standing female patient using both hands carefully on her shoulders, modern clinical room with anatomy posters in soft background, focused expert assessment, ${COMMON}`,
    size: 'landscape_4_3',
  },
  {
    name: '13-deportiva',
    prompt: `Colombian male chiropractor, wearing a fitted dark teal athletic polo shirt (${NO_LOGO}), treating a young athlete in a modern sports clinic, athlete sitting wearing sportswear, doctor focused on shoulder adjustment, motivational atmosphere, dynamic composition, ${COMMON}`,
    size: 'landscape_4_3',
  },
];

async function generate(p) {
  console.log(`\n[${p.name}]`);
  const submitR = await fetch('https://queue.fal.run/fal-ai/flux-lora', {
    method: 'POST',
    headers: { Authorization: 'Key ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: p.prompt,
      loras: [{ path: LORA_URL, scale: 1.0 }], // scale 1.0 = fidelidad máxima al doctor real
      image_size: p.size,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: false,
    }),
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
      fs.writeFileSync(path.join(OUT, p.name + '.jpg'), buf);
      console.log(`\n  ✅ ${(buf.length / 1024).toFixed(0)} KB`);
      return true;
    }
    if (status.status === 'FAILED' || status.status === 'ERROR') {
      console.log('\n  ❌ Failed'); return null;
    }
  }
  return null;
}

(async () => {
  console.log(`Regenerando ${PROMPTS.length} fotos prioritarias del Dr. Díaz`);
  console.log(`LoRA scale: 0.85 (anatomía más libre, cara conservada)\n`);
  let ok = 0;
  for (const p of PROMPTS) {
    const r = await generate(p);
    if (r) ok++;
  }
  console.log(`\n\n✅ ${ok}/${PROMPTS.length} regeneradas`);
  console.log(`Costo estimado: $${(ok * 0.05).toFixed(2)}`);
})();
