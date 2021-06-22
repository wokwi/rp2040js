export const PIO_SRC_PINS = 0;
export const PIO_SRC_X = 1;
export const PIO_SRC_Y = 2;
export const PIO_SRC_NULL = 3;
export const PIO_SRC_STATUS = 5;
export const PIO_SRC_ISR = 6;
export const PIO_SRC_OSR = 7;

export const PIO_DEST_PINS = 0;
export const PIO_DEST_X = 1;
export const PIO_DEST_Y = 2;
export const PIO_DEST_NULL = 3;
export const PIO_DEST_PINDIRS = 4;
export const PIO_DEST_PC = 5;
export const PIO_DEST_ISR = 6;
export const PIO_DEST_EXEC = 7;

export const PIO_MOV_DEST_PINS = 0;
export const PIO_MOV_DEST_X = 1;
export const PIO_MOV_DEST_Y = 2;
export const PIO_MOV_DEST_EXEC = 4;
export const PIO_MOV_DEST_PC = 5;
export const PIO_MOV_DEST_ISR = 6;
export const PIO_MOV_DEST_OSR = 7;

export const PIO_OP_NONE = 0;
export const PIO_OP_INVERT = 1;
export const PIO_OP_BITREV = 2;

export const PIO_WAIT_SRC_GPIO = 0;
export const PIO_WAIT_SRC_PIN = 1;
export const PIO_WAIT_SRC_IRQ = 2;

export const PIO_COND_ALWAYS = 0;
export const PIO_COND_NOTX = 1;
export const PIO_COND_XDEC = 2;
export const PIO_COND_NOTY = 3;
export const PIO_COND_YDEC = 4;
export const PIO_COND_XNEY = 5;
export const PIO_COND_PIN = 6;
export const PIO_COND_NOTEMPTYOSR = 7;

export function pioJMP(cond: number = 0, address: number, delay: number = 0) {
  return ((delay & 0x1f) << 8) | ((cond & 0x7) << 5) | (address & 0x1f);
}

export function pioWAIT(polarity: boolean, src: number, index: number, delay: number = 0) {
  return (
    (1 << 13) |
    ((delay & 0x1f) << 8) |
    ((polarity ? 1 : 0) << 7) |
    ((src & 0x3) << 5) |
    (index & 0x1f)
  );
}

export function pioIN(src: number, bitCount: number, delay: number = 0) {
  return (2 << 13) | ((delay & 0x1f) << 8) | ((src & 0x7) << 5) | (bitCount & 0x1f);
}

export function pioOUT(Dest: number, bitCount: number, delay: number = 0) {
  return (3 << 13) | ((delay & 0x1f) << 8) | ((Dest & 0x7) << 5) | (bitCount & 0x1f);
}

export function pioPUSH(ifFull: boolean, noBlock: boolean, delay: number = 0) {
  return (4 << 13) | ((delay & 0x1f) << 8) | ((ifFull ? 1 : 0) << 6) | ((noBlock ? 1 : 0) << 5);
}

export function pioPULL(ifEmpty: boolean, noBlock: boolean, delay: number = 0) {
  return (
    (4 << 13) |
    ((delay & 0x1f) << 8) |
    (1 << 7) |
    ((ifEmpty ? 1 : 0) << 6) |
    ((noBlock ? 1 : 0) << 5)
  );
}

export function pioMOV(dest: number, op: number = 0, src: number, delay: number = 0) {
  return (5 << 13) | ((delay & 0x1f) << 8) | ((dest & 0x7) << 5) | ((op & 0x3) << 3) | (src & 0x7);
}

export function pioIRQ(clear: boolean, wait: boolean, index: number, delay: number = 0) {
  return (
    (6 << 13) |
    ((delay & 0x1f) << 8) |
    ((clear ? 1 : 0) << 6) |
    ((wait ? 1 : 0) << 5) |
    (index & 0x1f)
  );
}

export function pioSET(dest: number, data: number, delay: number = 0) {
  return (7 << 13) | ((delay & 0x1f) << 8) | ((dest & 0x7) << 5) | (data & 0x1f);
}
