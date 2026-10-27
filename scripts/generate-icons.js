import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(width, height, pixelFn) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  
  const ihdrChunk = makeChunk('IHDR', ihdr);
  
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x / (width - 1), y / (height - 1), x, y, width, height);
      const off = 1 + x * 4;
      row[off] = Math.round(Math.min(255, Math.max(0, r)));
      row[off+1] = Math.round(Math.min(255, Math.max(0, g)));
      row[off+2] = Math.round(Math.min(255, Math.max(0, b)));
      row[off+3] = Math.round(Math.min(255, Math.max(0, a)));
    }
    rawRows.push(row);
  }
  
  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Generate nice rounded app icon with database cylinder stacks & glowing beacon pulse
function iconPixelShader(u, v, x, y, width, height) {
  // Center is (0.5, 0.5)
  const cx = u - 0.5;
  const cy = v - 0.5;
  const distFromCenter = Math.sqrt(cx * cx + cy * cy);

  // Rounded rectangle background (radius ~ 0.44)
  const cornerR = 0.22;
  const qx = Math.max(0, Math.abs(cx) - (0.46 - cornerR));
  const qy = Math.max(0, Math.abs(cy) - (0.46 - cornerR));
  const roundedDist = Math.sqrt(qx * qx + qy * qy);
  
  if (roundedDist > cornerR) {
    // Outside icon bounds
    return [0, 0, 0, 0];
  }

  // Smooth anti-aliased edge
  let alpha = 255;
  const edgeDist = cornerR - roundedDist;
  if (edgeDist < (1 / width)) {
    alpha = Math.max(0, Math.min(255, edgeDist * width * 255));
  }

  // Background gradient: Deep dark slate / navy (#0f172a to #1e1b4b)
  let r = 15 + u * 25;
  let g = 23 + v * 15;
  let b = 42 + (1 - v) * 45;

  // Database cylinder stacks logic (3 layered discs centered at x=0.5, y around 0.35, 0.52, 0.69)
  // Each cylinder is an ellipse.
  // Cylinder top ellipse: (x - 0.5)^2 / a^2 + (y - y0)^2 / b^2 <= 1
  const a = 0.28;
  const bAxis = 0.085;

  // Let's check cylinders at y levels
  const layers = [
    { y: 0.35, isTop: true },
    { y: 0.52, isTop: false },
    { y: 0.69, isTop: false }
  ];

  // Draw cylinders with cyan/indigo glow
  let inCylinder = false;
  let cylR = 0, cylG = 0, cylB = 0;

  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const dy = v - layer.y;
    const dx = u - 0.5;
    
    // Top cap of cylinder
    const inTopCap = (dx * dx) / (a * a) + (dy * dy) / (bAxis * bAxis) <= 1;
    
    // Body of cylinder (downwards by 0.12)
    const bodyHeight = 0.11;
    const inBody = (Math.abs(dx) <= a) && (dy >= 0) && (dy <= bodyHeight) && 
                   ((dx * dx) / (a * a) + ((dy - bodyHeight) * (dy - bodyHeight)) / (bAxis * bAxis) <= 1 || dy <= bodyHeight);

    if (inTopCap || inBody) {
      inCylinder = true;
      const shade = inTopCap ? 1.2 : (0.8 + 0.4 * (1 - Math.abs(dx)/a));
      // Gradient on cylinder: Cyan to Indigo
      // Top cylinder brighter, beacon pulse in center
      const levelColor = i === 0 ? [56, 189, 248] : (i === 1 ? [99, 102, 241] : [79, 70, 229]);
      cylR = levelColor[0] * shade;
      cylG = levelColor[1] * shade;
      cylB = levelColor[2] * shade;
      
      // Top cap highlight ring
      if (inTopCap) {
        const rad = Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (bAxis * bAxis));
        if (rad > 0.85 && rad <= 1.0) {
          cylR = Math.min(255, cylR + 60);
          cylG = Math.min(255, cylG + 60);
          cylB = Math.min(255, cylB + 60);
        }
      }
      break;
    }
  }

  if (inCylinder) {
    r = cylR;
    g = cylG;
    b = cylB;
  }

  // Beacon beam / signal ray from the top center
  const beamDx = Math.abs(u - 0.5);
  if (v < 0.35 && beamDx < (0.35 - v) * 0.45 + 0.04) {
    const beamIntensity = (1 - v / 0.35) * (1 - beamDx / ((0.35 - v) * 0.45 + 0.04));
    r = Math.min(255, r + 56 * beamIntensity * 2.5);
    g = Math.min(255, g + 189 * beamIntensity * 2);
    b = Math.min(255, b + 248 * beamIntensity * 2.5);
  }

  // Beacon glowing dot at (0.5, 0.22)
  const beaconDist = Math.sqrt((u - 0.5) * (u - 0.5) + (v - 0.22) * (v - 0.22));
  if (beaconDist < 0.08) {
    const pulse = 1 - beaconDist / 0.08;
    r = Math.min(255, r + 255 * pulse);
    g = Math.min(255, g + 240 * pulse);
    b = Math.min(255, b + 180 * pulse);
  }

  return [r, g, b, alpha];
}

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const pngBuf = createPng(size, size, iconPixelShader);
  const outPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`Generated ${outPath} (${pngBuf.length} bytes)`);
});

// Also write an SVG version
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="beamGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#818cf8" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="cyl1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="cyl2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
    <linearGradient id="cyl3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#3730a3"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <rect width="128" height="128" rx="28" fill="url(#bg)"/>

  <!-- Beacon Light Rays -->
  <polygon points="64,28 36,4 92,4" fill="url(#beamGrad)" opacity="0.6"/>
  <circle cx="64" cy="28" r="7" fill="#38bdf8" filter="url(#glow)"/>
  <circle cx="64" cy="28" r="3" fill="#ffffff"/>

  <!-- Cylinder 3 (Bottom) -->
  <path d="M 28,88 A 36,11 0 0,0 100,88 V 99 A 36,11 0 0,1 28,99 Z" fill="url(#cyl3)"/>
  <ellipse cx="64" cy="88" rx="36" ry="11" fill="url(#cyl3)" stroke="#6366f1" stroke-width="1.5"/>

  <!-- Cylinder 2 (Middle) -->
  <path d="M 28,66 A 36,11 0 0,0 100,66 V 77 A 36,11 0 0,1 28,77 Z" fill="url(#cyl2)"/>
  <ellipse cx="64" cy="66" rx="36" ry="11" fill="url(#cyl2)" stroke="#818cf8" stroke-width="1.5"/>

  <!-- Cylinder 1 (Top) -->
  <path d="M 28,44 A 36,11 0 0,0 100,44 V 55 A 36,11 0 0,1 28,55 Z" fill="url(#cyl1)"/>
  <ellipse cx="64" cy="44" rx="36" ry="11" fill="url(#cyl1)" stroke="#bae6fd" stroke-width="1.5"/>

  <!-- Pulse rings around beacon -->
  <circle cx="64" cy="28" r="14" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.4"/>
  <circle cx="64" cy="28" r="21" fill="none" stroke="#38bdf8" stroke-width="1" opacity="0.2"/>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent);
console.log('Generated icon.svg');
