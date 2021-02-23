export function opcodeADCS(Rdn: number, Rm: number) {
  return (0b0100000101 << 6) | ((Rm & 7) << 3) | (Rdn & 7);
}

export function opcodeADDS2(Rdn: number, imm8: number) {
  return (0b00110 << 11) | ((Rdn & 7) << 8) | (imm8 & 0xff);
}

export function opcodeBL(imm: number) {
  const imm11 = (imm >> 1) & 0x7ff;
  const imm10 = (imm >> 12) & 0x3ff;
  const s = imm < 0 ? 1 : 0;
  const j2 = 1 - (((imm >> 22) & 0x1) ^ s);
  const j1 = 1 - (((imm >> 23) & 0x1) ^ s);
  const opcode =
    (0b1101 << 28) | (j1 << 29) | (j2 << 27) | (imm11 << 16) | (0b11110 << 11) | (s << 10) | imm10;
  return opcode >>> 0;
}

export function opcodeBX(Rm: number) {
  return (0b010001110 << 7) | Rm << 3;
}

export function opcodeLDMIA(Rn: number, registers: number) {
  return (0b11001 << 11) | ((Rn & 0x7) << 8) | (registers & 0xff);
}

export function opcodeLDRB(Rt: number, Rn: number, imm5: number) {
  return (0b01111 << 11) | ((imm5 & 0x1f) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeLSRS(Rd: number, Rm: number, imm5: number) {
  return (0b00001 << 11) | ((imm5 & 0x1f) << 6) | ((Rm & 0x7) << 3) | (Rd & 0x7);
}

export function opcodeRSBS(Rd: number, Rn: number) {
  return (0b0100001001 << 6) | ((Rn & 0x7) << 3) | (Rd & 0x7);
}

export function opcodeSUBS2(Rdn: number, imm8: number) {
  return (0b00111 << 11) | ((Rdn & 7) << 8) | (imm8 & 0xff);
}

export function opcodeUXTB(Rd: number, Rm: number) {
  return (0b1011001011 << 6) | ((Rm & 7) << 3) | (Rd & 7);
}
