export function opcodePIOJMP(Cond: number = 0, Address: number, Delay: number = 0) {
  return ((Delay & 0x1f) << 8) | ((Cond & 0x7) << 5) | (Address & 0x1f);
}

export function opcodePIOWAIT(Pol: number, Src: number, Index: number, Delay: number = 0) {
  return (
    (1 << 13) | ((Delay & 0x1f) << 8) | ((Pol & 0x1) << 7) | ((Src & 0x3) << 5) | (Index & 0x1f)
  );
}

export function opcodePIOIN(Src: number, bitCount: number, Delay: number = 0) {
  return (2 << 13) | ((Delay & 0x1f) << 8) | ((Src & 0x7) << 5) | (bitCount & 0x1f);
}

export function opcodePIOOUT(Dest: number, bitCount: number, Delay: number = 0) {
  return (3 << 13) | ((Delay & 0x1f) << 8) | ((Dest & 0x7) << 5) | (bitCount & 0x1f);
}

export function opcodePIOPUSH(ifFull: number = 0, Blk: number, Delay: number = 0) {
  return (4 << 13) | ((Delay & 0x1f) << 8) | ((ifFull & 1) << 6) | ((Blk & 1) << 5);
}

export function opcodePIOPULL(ifEmpty: number = 0, Blk: number, Delay: number = 0) {
  return (4 << 13) | ((Delay & 0x1f) << 8) | (1 << 7) | ((ifEmpty & 1) << 6) | ((Blk & 1) << 5);
}

export function opcodePIOMOV(Dest: number, Op: number = 0, Src: number, Delay: number = 0) {
  return (5 << 13) | ((Delay & 0x1f) << 8) | ((Dest & 0x7) << 5) | ((Op & 0x3) << 3) | (Src & 0x3);
}

export function opcodePIOIRQ(Clr: number, Wait: number, Index: number, Delay: number = 0) {
  return (6 << 13) | ((Delay & 0x1f) << 8) | ((Clr & 1) << 6) | ((Wait & 1) << 5) | (Index & 0x1f);
}

export function opcodePIOSET(Dest: number, Data: number, Delay: number = 0) {
  return (7 << 13) | ((Delay & 0x1f) << 8) | ((Dest & 0x7) << 5) | (Data & 0x1f);
}
