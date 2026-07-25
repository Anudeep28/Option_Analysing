/**
 * Generate simple solid-color PNG icons for the PWA / TWA manifest.
 * Run with: node scripts/generate-icons.js
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZES = [192, 512];
const COLOR = { r: 0, g: 0, b: 0 }; // Black background
const OUT_DIR = path.join(__dirname, "..", "public");

function writeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const chunk = Buffer.concat([len, typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([chunk, crc]);
}

function crc32(buf) {
  // Node's zlib.crc32 is available since v22. Use it when present, otherwise compute manually.
  if (zlib.crc32) return zlib.crc32(buf);
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return ~c >>> 0;
}

function createSolidPng(size, color) {
  const rowSize = 1 + size * 3; // filter byte + RGB pixels
  const raw = Buffer.alloc(rowSize * size);
  for (let y = 0; y < size; y++) {
    const offset = y * rowSize;
    raw[offset] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const px = offset + 1 + x * 3;
      raw[px] = color.r;
      raw[px + 1] = color.g;
      raw[px + 2] = color.b;
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    signature,
    writeChunk("IHDR", ihdr),
    writeChunk("IDAT", compressed),
    writeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const size of SIZES) {
    const png = createSolidPng(size, COLOR);
    const filePath = path.join(OUT_DIR, `icon-${size}.png`);
    fs.writeFileSync(filePath, png);
    console.log(`Created ${filePath}`);
  }
}

main();
