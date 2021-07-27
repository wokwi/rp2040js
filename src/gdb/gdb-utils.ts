export function encodeHexByte(value: number) {
  return (value >> 4).toString(16) + (value & 0xf).toString(16);
}

export function encodeHexBuf(buf: Uint8Array) {
  return Array.from(buf).map(encodeHexByte).join('');
}

export function encodeHexUint32BE(value: number) {
  return encodeHexBuf(
    new Uint8Array([(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff])
  );
}

export function encodeHexUint32(value: number) {
  const buf = new Uint32Array([value]);
  return encodeHexBuf(new Uint8Array(buf.buffer));
}

export function decodeHexBuf(encoded: string) {
  const result = new Uint8Array(encoded.length / 2);
  for (let i = 0; i < result.length; i++) {
    result[i] = parseInt(encoded.substr(i * 2, 2), 16);
  }
  return result;
}

export function decodeHexUint32Array(encoded: string) {
  return new Uint32Array(decodeHexBuf(encoded).buffer);
}

export function decodeHexUint32(encoded: string) {
  return decodeHexUint32Array(encoded)[0];
}

export function gdbChecksum(text: string) {
  const value =
    text
      .split('')
      .map((c) => c.charCodeAt(0))
      .reduce((a, b) => a + b, 0) & 0xff;
  return encodeHexByte(value);
}

export function gdbMessage(value: string) {
  return `$${value}#${gdbChecksum(value)}`;
}
