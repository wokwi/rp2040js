export function opcodeADCS(Rdn: number, Rm: number) {
  return (0b0100000101 << 6) | ((Rm & 7) << 3) | (Rdn & 7);
}

export function opcodeADDS2(Rdn: number, imm8: number) {
  return (0b00110 << 11) | ((Rdn & 7) << 8) | (imm8 & 0xff);
}

export function opcodeLDRB(Rt: number, Rn: number, imm5: number) {
  return (0b01111 << 11) | ((imm5 & 0x1f) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
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
