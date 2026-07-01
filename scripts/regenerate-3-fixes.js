// Regenera 3 fotos específicas con prompts mejorados.
// 02: cambiar composición a wide shot con paciente claro
// 04: encuadre más alto (hombros para arriba)
// 13: eliminar polo (camisa simple, evitar logos)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY = process.env.FAL_KEY;
const LORA_URL = 'https://v3b.fal.media/files/b/0a983cf3/QShlwv20UzOfmjgUng2VL_pytorch_lora_weights.safetensors';
const OUT = path.join(__dirname, '..', 'public', 'images', 'dr-diaz');

const NO_LOGO = 'absolutely no logos, no text, no embroidery, no writing, no symbols, no badges, no monogram, no print, completely solid color fabric only';
const COMMON = 'photorealistic, professional photography, soft natural lighting, 4k, color graded, well-groomed beard';

const PROMPTS = [
  {
    name: '02-examining-patient',
    prompt: `Wide-angle establishing shot of a Colombian male chiropractor wearing solid dark navy clinical scrubs (${NO_LOGO}), standing beside a treatment table where a female patient lies face down, doctor's hands gently positioned on patient's mid-back to perform an adjustment, modern bright clinic with anatomy posters on wall, soft daylight from window, both doctor and patient visible in frame, medium shot from the side, ${COMMON}`,
    size: 'landscape_4_3',
  },
  {
    name: '04-charla-educativa',
    prompt: `Editorial portrait of a Colombian male chiropractor speaking to camera as if giving a class, framed from chest up only (no hands or torso visible), wearing a solid light blue button-up shirt (${NO_LOGO}), warm engaging expression mid-speech, modern clinic conference room softly blurred background with subtle bokeh, head and shoulders composition, slightly low angle giving authority, ${COMMON}`,
    size: 'portrait_4_3',
  },
  {
    name: '13-deportiva',
    prompt: `Colombian male chiropractor wearing a completely plain solid charcoal gray t-shirt (${NO_LOGO}, no graphics, no print, no design), treating a young athlete in a modern sports rehab clinic, athlete sitting in athletic shorts and tank top, doctor's hands focused on the athlete's shoulder adjustment, motivational gym equipment softly in background, dynamic side angle composition, ${COMMON}`,
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
      loras: [{ path: LORA_URL, scale: 1.0 }],
      image_size: p.size,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: false,
    }),
  });
  const submitted = await submitR.json();
  if (!submitted.request_id) { console.log('  ❌ Submit failed'); return null; }

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const s = await fetch(submitted.status_url, { headers: { Authorization: 'Key ' + KEY } });
    const status = await s.json();
    process.stdout.write('.');
    if (status.status === 'COMPLETED') {
      const r2 = await fetch(submitted.response_url, { headers: { Authorization: 'Key ' + KEY } });
      const final = await r2.json();
      const url = final.images?.[0]?.url;
      if (!url) return null;
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      fs.writeFileSync(path.join(OUT, p.name + '.jpg'), buf);
      console.log(`\n  ✅ ${(buf.length / 1024).toFixed(0)} KB`);
      return true;
    }
    if (status.status === 'FAILED') { console.log('\n  ❌'); return null; }
  }
  return null;
}

(async () => {
  console.log(`Regenerando 3 fotos con fixes\n`);
  let ok = 0;
  for (const p of PROMPTS) { if (await generate(p)) ok++; }
  console.log(`\n✅ ${ok}/${PROMPTS.length} → costo $${(ok * 0.05).toFixed(2)}`);
})();
