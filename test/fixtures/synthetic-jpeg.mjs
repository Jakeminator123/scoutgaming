// Procedural, neutral gray baseline JPEG. No camera or personal image fixture.
export function syntheticJpeg(width = 8, height = 8) {
  const segment = (code, values) => {
    const n = values.length + 2;
    return Buffer.from([0xff, code, n >> 8, n & 255, ...values]);
  };
  const blocks = Math.ceil(width / 8) * Math.ceil(height / 8);
  // One-bit DC-zero and AC-end-of-block codes; pad last byte with ones.
  const scan = Buffer.alloc(Math.ceil(blocks * 2 / 8));
  if (blocks * 2 % 8) scan[scan.length - 1] = (1 << (8 - blocks * 2 % 8)) - 1;
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xdb, [0, ...Array(64).fill(1)]),
    segment(0xc4, [0, 1, ...Array(15).fill(0), 0, 0x10, 1, ...Array(15).fill(0), 0]),
    segment(0xc0, [8, height >> 8, height & 255, width >> 8, width & 255, 1, 1, 0x11, 0]),
    segment(0xda, [1, 1, 0, 0, 63, 0]), scan, Buffer.from([0xff, 0xd9]),
  ]);
}
