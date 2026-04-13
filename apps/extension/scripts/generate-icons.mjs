import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const iconsDirectory = resolve(scriptDirectory, '..', 'public', 'icons');
const sizes = [16, 32, 48, 128];

function makeCrcTable() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let current = index;

    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) === 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    }

    table[index] = current >>> 0;
  }

  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
  let current = 0xffffffff;

  for (const value of buffer) {
    current = crcTable[(current ^ value) & 0xff] ^ (current >>> 8);
  }

  return (current ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function setPixel(buffer, size, x, y, rgba) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }

  const index = (y * size + x) * 4;
  buffer[index] = rgba[0];
  buffer[index + 1] = rgba[1];
  buffer[index + 2] = rgba[2];
  buffer[index + 3] = rgba[3];
}

function fillRect(buffer, size, left, top, width, height, rgba) {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      setPixel(buffer, size, x, y, rgba);
    }
  }
}

function fillRoundedRect(buffer, size, left, top, width, height, radius, rgba) {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      const dx =
        x < left + radius
          ? left + radius - x
          : x >= left + width - radius
            ? x - (left + width - radius - 1)
            : 0;
      const dy =
        y < top + radius
          ? top + radius - y
          : y >= top + height - radius
            ? y - (top + height - radius - 1)
            : 0;

      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(buffer, size, x, y, rgba);
      }
    }
  }
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4, 0);
  const background = [15, 23, 42, 255];
  const accent = [20, 184, 166, 255];
  const line = [248, 250, 252, 255];
  const glow = [56, 189, 248, 255];
  const inset = Math.max(1, Math.round(size * 0.1));
  const radius = Math.max(2, Math.round(size * 0.22));

  fillRoundedRect(rgba, size, 0, 0, size, size, radius, background);
  fillRoundedRect(
    rgba,
    size,
    inset,
    inset,
    size - inset * 2,
    size - inset * 2,
    Math.max(2, radius - inset),
    accent
  );

  const cardInset = Math.max(2, Math.round(size * 0.22));
  const cardRadius = Math.max(2, Math.round(size * 0.12));
  fillRoundedRect(
    rgba,
    size,
    cardInset,
    cardInset,
    size - cardInset * 2,
    size - cardInset * 2,
    cardRadius,
    background
  );

  const barLeft = Math.round(size * 0.3);
  const barWidth = Math.round(size * 0.4);
  const barHeight = Math.max(1, Math.round(size * 0.07));
  const barGap = Math.max(1, Math.round(size * 0.08));
  const firstBarTop = Math.round(size * 0.31);

  fillRect(rgba, size, barLeft, firstBarTop, barWidth, barHeight, line);
  fillRect(
    rgba,
    size,
    barLeft,
    firstBarTop + barHeight + barGap,
    Math.round(barWidth * 0.86),
    barHeight,
    line
  );
  fillRect(
    rgba,
    size,
    barLeft,
    firstBarTop + (barHeight + barGap) * 2,
    Math.round(barWidth * 0.7),
    barHeight,
    line
  );

  for (let index = 0; index < Math.round(size * 0.22); index += 1) {
    const x = Math.round(size * 0.18) + index;
    const y = Math.round(size * 0.2) + index;
    fillRect(rgba, size, x, y, Math.max(1, Math.round(size * 0.05)), Math.max(1, Math.round(size * 0.05)), glow);
  }

  return rgba;
}

function encodePng(size, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);

  for (let row = 0; row < size; row += 1) {
    raw[row * (stride + 1)] = 0;
    rgba.copy(raw, row * (stride + 1) + 1, row * stride, row * stride + stride);
  }

  const idat = deflateSync(raw);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync(iconsDirectory, { recursive: true });

for (const size of sizes) {
  const rgba = drawIcon(size);
  const png = encodePng(size, rgba);
  const outputPath = resolve(iconsDirectory, `icon-${size}.png`);
  writeFileSync(outputPath, png);
}
