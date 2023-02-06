export function bit(n: number) {
  return 1 << n;
}

export function s32(n: number) {
  return n | 0;
}

export function u32(n: number) {
  return n >>> 0;
}
