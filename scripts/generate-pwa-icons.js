// Genera iconos PNG para PWA + Apple Touch desde el SVG del logo.
// Salida en /public/icons/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcSvg = path.join(root, 'public', 'logos', 'v1-icon-only.svg');
const outDir = path.join(root, 'public', 'icons');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const svgBuffer = fs.readFileSync(srcSvg);

// Wrapper SVG para fondo blanco con padding (mejor para maskable y aspect square)
const wrapSvg = (size, padding = 0.12) => {
  const inner = Math.round(size * (1 - padding * 2));
  const offset = Math.round(size * padding);
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#ffffff"/>
      <g transform="translate(${offset}, ${offset})">
        <svg width="${inner}" height="${inner}" viewBox="0 0 64 64">${svgBuffer.toString().replace(/<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}</svg>
      </g>
    </svg>
  `);
};

// Maskable: con safe area de 10% al rededor (Android adaptive icons)
const wrapMaskable = (size) => {
  const safe = Math.round(size * 0.20);
  const inner = size - safe * 2;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#0f766e"/>
      <g transform="translate(${safe}, ${safe})">
        <svg width="${inner}" height="${inner}" viewBox="0 0 64 64">
          <path d="M 32 10 Q 42 12 40 18 Q 38 22 32 22 Q 26 22 24 18 Q 22 12 32 10 Z" fill="white"/>
          <path d="M 32 22 Q 22 24 24 30 Q 26 34 32 34 Q 38 34 40 30 Q 42 24 32 22 Z" fill="white"/>
          <path d="M 32 34 Q 42 36 40 42 Q 38 46 32 46 Q 26 46 24 42 Q 22 36 32 34 Z" fill="white"/>
          <path d="M 32 46 Q 22 48 24 54 Q 26 58 32 58 Q 38 58 40 54 Q 42 48 32 46 Z" fill="white"/>
        </svg>
      </g>
    </svg>
  `);
};

const sizes = [
  { size: 192, name: 'icon-192.png', kind: 'any' },
  { size: 512, name: 'icon-512.png', kind: 'any' },
  { size: 192, name: 'icon-192-maskable.png', kind: 'maskable' },
  { size: 512, name: 'icon-512-maskable.png', kind: 'maskable' },
  { size: 180, name: 'apple-touch-icon.png', kind: 'any' },
  { size: 32, name: 'favicon-32.png', kind: 'any' },
  { size: 16, name: 'favicon-16.png', kind: 'any' },
];

async function run() {
  for (const { size, name, kind } of sizes) {
    const svg = kind === 'maskable' ? wrapMaskable(size) : wrapSvg(size);
    const out = path.join(outDir, name);
    await sharp(svg).png().toFile(out);
    console.log(`✓ ${name} (${size}px, ${kind})`);
  }
  console.log('\n🎨 Iconos PWA generados en /public/icons/');
}

run().catch((err) => { console.error('❌', err); process.exit(1); });
