// Genera batch de fotos del Dr. Díaz con su LoRA.
// Prompts ajustados: bata blanca limpia sin texto random.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY = process.env.FAL_KEY;
const LORA_URL = 'https://v3b.fal.media/files/b/0a983cf3/QShlwv20UzOfmjgUng2VL_pytorch_lora_weights.safetensors';
const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'dr-diaz');

const COMMON = 'photorealistic, sharp focus on face, professional photography, soft natural lighting, 4k, high detail, color graded';
const NEGATIVE_PROMPT_HINT = 'blank coat, no text, no logo, no embroidery, no writing, no labels, plain white fabric';

const PROMPTS = [
  {
    name: '01-portrait-formal',
    prompt: `Professional headshot portrait of a Colombian male chiropractor doctor wearing a clean white medical coat (${NEGATIVE_PROMPT_HINT}), warm friendly expression, slight smile, neutral medical clinic background slightly blurred, looking confident and professional, ${COMMON}`,
    size: 'portrait_4_3',
  },
  {
    name: '02-examining-patient',
    prompt: `Colombian male chiropractor in a clean white medical coat (${NEGATIVE_PROMPT_HINT}) examining a patient's spine in a modern bright clinic, hands gently positioned on patient's back, focused professional expression, soft natural light coming through window, ${COMMON}`,
    size: 'landscape_4_3',
  },
  {
    name: '03-jornada-rural',
    prompt: `Colombian male chiropractor in a clean white medical coat (${NEGATIVE_PROMPT_HINT}) attending patients in a small rural town clinic in Boyacá Colombia, simple wooden interior, warm afternoon light, kind expression, talking with elderly patient sitting nearby, documentary photography style, ${COMMON}`,
    size: 'landscape_4_3',
  },
  {
    name: '04-charla-educativa',
    prompt: `Colombian male chiropractor in a clean white medical coat (${NEGATIVE_PROMPT_HINT}) giving an educational talk in a modern conference room, gesturing while explaining spine anatomy with a small audience listening, confident posture, professional environment, ${COMMON}`,
    size: 'landscape_16_9',
  },
  {
    name: '05-casual-smile',
    prompt: `Casual portrait of Colombian male chiropractor wearing a light blue button up shirt (no white coat), warm genuine smile, natural light, neutral office background, friendly approachable, candid moment, ${COMMON}`,
    size: 'portrait_4_3',
  },
  {
    name: '06-instruments-diagnostic',
    prompt: `Colombian male chiropractor in a clean white medical coat (${NEGATIVE_PROMPT_HINT}) reviewing a spinal X-ray on a lightbox, focused concentrated expression, modern clinical setting, dramatic side lighting on the X-ray illuminating his face, ${COMMON}`,
    size: 'landscape_4_3',
  },
  {
    name: '07-portrait-hero',
    prompt: `Confident portrait of Colombian male chiropractor in a clean crisp white medical coat (${NEGATIVE_PROMPT_HINT}), arms slightly crossed, looking directly at camera with warm authoritative gaze, modern minimalist clinic background slightly blurred, premium editorial style, ${COMMON}`,
    size: 'portrait_4_3',
  },
  {
    name: '08-with-patient-talking',
    prompt: `Colombian male chiropractor in a clean white medical coat (${NEGATIVE_PROMPT_HINT}) sitting and talking attentively with a middle-aged patient, taking notes on a clipboard, warm consultation environment, natural conversation, both visible, ${COMMON}`,
    size: 'landscape_4_3',
  },
  {
    name: '09-walking-clinic',
    prompt: `Colombian male chiropractor walking through a modern bright corridor of a clinic wearing a clean white medical coat (${NEGATIVE_PROMPT_HINT}), candid moment, natural stride, looking forward confidently, contemporary architecture, ${COMMON}`,
    size: 'portrait_4_3',
  },
  {
    name: '10-jornada-arrival',
    prompt: `Colombian male chiropractor arriving at a small Andean town in Boyacá Colombia, carrying a medical bag, mountain landscape background, traditional colonial architecture, golden hour lighting, documentary photography, ${COMMON}`,
    size: 'landscape_16_9',
  },
  {
    name: '11-team-thumbnail',
    prompt: `Square headshot of Colombian male chiropractor wearing a clean white medical coat (${NEGATIVE_PROMPT_HINT}), neutral gray studio background, soft three-point professional lighting, looking directly at camera with subtle confident smile, suitable for team page, ${COMMON}`,
    size: 'square_hd',
  },
  {
    name: '12-checking-posture',
    prompt: `Colombian male chiropractor in a clean white medical coat (${NEGATIVE_PROMPT_HINT}) checking the posture of a standing patient using both hands on their shoulders, modern clinical room with anatomy posters in soft background, focused expert assessment, ${COMMON}`,
    size: 'landscape_4_3',
  },
];

async function generateOne({ name, prompt, size }) {
  console.log(`\n[${name}]`);

  const submitR = await fetch('https://queue.fal.run/fal-ai/flux-lora', {
    method: 'POST',
    headers: { Authorization: 'Key ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      loras: [{ path: LORA_URL, scale: 1.0 }],
      image_size: size,
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

  // Poll
  let final;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const s = await fetch(submitted.status_url, { headers: { Authorization: 'Key ' + KEY } });
    const status = await s.json();
    process.stdout.write('.');
    if (status.status === 'COMPLETED') {
      const r2 = await fetch(submitted.response_url, { headers: { Authorization: 'Key ' + KEY } });
      final = await r2.json();
      break;
    }
    if (status.status === 'FAILED' || status.status === 'ERROR') {
      console.log('\n  ❌ Failed:', status);
      return null;
    }
  }

  if (!final?.images?.[0]?.url) {
    console.log('\n  ❌ No image URL');
    return null;
  }

  const imgUrl = final.images[0].url;
  const imgR = await fetch(imgUrl);
  const buf = Buffer.from(await imgR.arrayBuffer());
  const filePath = path.join(OUT_DIR, name + '.jpg');
  fs.writeFileSync(filePath, buf);
  console.log(`\n  ✅ ${(buf.length / 1024).toFixed(0)} KB → ${name}.jpg`);
  return { name, url: imgUrl, file: filePath, size: buf.length };
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Generando ${PROMPTS.length} fotos del Dr. Díaz con LoRA...`);
  console.log(`LoRA: ${LORA_URL.split('/').pop()}`);
  console.log(`Output: ${OUT_DIR}`);

  const results = [];
  for (const p of PROMPTS) {
    const r = await generateOne(p);
    if (r) results.push(r);
  }

  console.log(`\n\n✅ ${results.length}/${PROMPTS.length} imágenes generadas`);
  console.log(`Costo estimado: ~$${(results.length * 0.05).toFixed(2)} USD`);

  // Manifesto JSON para luego usar en componentes
  fs.writeFileSync(
    path.join(OUT_DIR, '_manifest.json'),
    JSON.stringify({ lora: LORA_URL, generated_at: new Date().toISOString(), images: results }, null, 2)
  );
  console.log('Manifest: public/images/dr-diaz/_manifest.json');
})();
