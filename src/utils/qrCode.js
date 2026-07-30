// Generates a Version 5-L QR matrix locally. Version 5-L holds 106 UTF-8 bytes,
// which comfortably fits every OVTech certificate verification URL.
const SIZE = 37;
const DATA_CODEWORDS = 108;
const TOTAL_CODEWORDS = 134;

const multiply = (left, right) => {
  let result = 0;
  while (right) {
    if (right & 1) result ^= left;
    left = (left << 1) ^ ((left & 0x80) ? 0x11d : 0);
    right >>= 1;
  }
  return result;
};

const errorCorrection = (data) => {
  const degree = TOTAL_CODEWORDS - DATA_CODEWORDS;
  const divisor = Array(degree).fill(0);
  divisor[degree - 1] = 1;
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    for (let term = 0; term < degree; term += 1) {
      divisor[term] = multiply(divisor[term], root);
      if (term + 1 < degree) divisor[term] ^= divisor[term + 1];
    }
    root = multiply(root, 2);
  }

  const remainder = Array(degree).fill(0);
  data.forEach((value) => {
    const factor = value ^ remainder.shift();
    remainder.push(0);
    divisor.forEach((coefficient, index) => {
      remainder[index] ^= multiply(coefficient, factor);
    });
  });
  return remainder;
};

const appendBits = (bits, value, length) => {
  for (let shift = length - 1; shift >= 0; shift -= 1) bits.push((value >>> shift) & 1);
};

const encode = (value) => {
  const bytes = [...new TextEncoder().encode(value)];
  if (bytes.length > 106) throw new Error("Certificate verification URL is too long for its QR code.");
  const bits = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, DATA_CODEWORDS * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(bits.slice(index, index + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  }
  for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) data.push(pad % 2 ? 0x11 : 0xec);
  return [...data, ...errorCorrection(data)];
};

const formatBits = () => {
  // Error-correction level L (01) and mask pattern 0 (000).
  let value = 0b01000 << 10;
  const generator = 0x537;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if ((value >>> bit) & 1) value ^= generator << (bit - 10);
  }
  return ((0b01000 << 10) | value) ^ 0x5412;
};

export const createQrMatrix = (value) => {
  const modules = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const reserved = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const set = (row, column, dark, isReserved = true) => {
    if (row < 0 || row >= SIZE || column < 0 || column >= SIZE) return;
    modules[row][column] = dark;
    if (isReserved) reserved[row][column] = true;
  };
  const finder = (row, column) => {
    for (let y = -1; y <= 7; y += 1) for (let x = -1; x <= 7; x += 1) {
      const dark = x >= 0 && x <= 6 && y >= 0 && y <= 6
        && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
      set(row + y, column + x, dark);
    }
  };
  finder(0, 0); finder(0, SIZE - 7); finder(SIZE - 7, 0);
  for (let index = 8; index < SIZE - 8; index += 1) {
    set(6, index, index % 2 === 0);
    set(index, 6, index % 2 === 0);
  }
  for (let y = -2; y <= 2; y += 1) for (let x = -2; x <= 2; x += 1) {
    set(30 + y, 30 + x, Math.max(Math.abs(x), Math.abs(y)) !== 1);
  }

  // Reserve and then write the two copies of the format information.
  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) { set(8, index, false); set(index, 8, false); }
  }
  for (let index = 0; index < 8; index += 1) {
    set(8, SIZE - 1 - index, false); set(SIZE - 1 - index, 8, false);
  }
  set(SIZE - 8, 8, true);

  const codewords = encode(value);
  const dataBits = [];
  codewords.forEach((byte) => appendBits(dataBits, byte, 8));
  let bitIndex = 0;
  let upward = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let step = 0; step < SIZE; step += 1) {
      const row = upward ? SIZE - 1 - step : step;
      for (let offset = 0; offset < 2; offset += 1) {
        const column = right - offset;
        if (!reserved[row][column]) {
          const bit = bitIndex < dataBits.length ? dataBits[bitIndex] : 0;
          modules[row][column] = Boolean(bit ^ ((row + column) % 2 === 0));
          bitIndex += 1;
        }
      }
    }
    upward = !upward;
  }

  const format = formatBits();
  for (let index = 0; index < 15; index += 1) {
    const dark = Boolean((format >>> index) & 1);
    const first = index < 6 ? [index, 8] : index < 8 ? [index + 1, 8] : index === 8 ? [8, 7] : [8, 14 - index];
    const second = index < 8 ? [8, SIZE - 1 - index] : [SIZE - 15 + index, 8];
    set(first[0], first[1], dark);
    set(second[0], second[1], dark);
  }
  set(SIZE - 8, 8, true);
  return modules;
};
