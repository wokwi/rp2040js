export function opcodeADCS(Rdn: number, Rm: number) {
  return (0b0100000101 << 6) | ((Rm & 7) << 3) | (Rdn & 7);
}

export function opcodeADDS1(Rd: number, Rn: number, imm3: number) {
  return (0b0001110 << 9) | ((imm3 & 0x7) << 6) | ((Rn & 7) << 3) | (Rd & 7);
}

export function opcodeADDS2(Rdn: number, imm8: number) {
  return (0b00110 << 11) | ((Rdn & 7) << 8) | (imm8 & 0xff);
}

export function opcodeADDspPlusImm(Rd: number, imm8: number) {
  return (0b10101 << 11) | ((Rd & 7) << 8) | ((imm8 >> 2) & 0xff);
}

export function opcodeADDsp2(imm: number) {
  return (0b101100000 << 7) | ((imm >> 2) & 0x7f);
}

export function opcodeADDSreg(Rd: number, Rn: number, Rm: number) {
  return (0b0001100 << 9) | ((Rm & 0x7) << 6) | ((Rn & 7) << 3) | (Rd & 7);
}

export function opcodeADDreg(Rdn: number, Rm: number) {
  return (0b01000100 << 8) | ((Rdn & 0x8) << 4) | ((Rm & 0xf) << 3) | (Rdn & 0x7);
}

export function opcodeADR(Rd: number, imm8: number) {
  return (0b10100 << 11) | ((Rd & 7) << 8) | ((imm8 >> 2) & 0xff);
}

export function opcodeANDS(Rn: number, Rm: number) {
  return (0b0100000000 << 6) | ((Rm & 7) << 3) | (Rn & 0x7);
}

export function opcodeASRS(Rd: number, Rm: number, imm5: number) {
  return (0b00010 << 11) | ((imm5 & 0x1f) << 6) | ((Rm & 0x7) << 3) | (Rd & 0x7);
}

export function opcodeBICS(Rdn: number, Rm: number) {
  return (0b0100001110 << 6) | ((Rm & 7) << 3) | (Rdn & 7);
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

export function opcodeBLX(Rm: number) {
  return (0b010001111 << 7) | (Rm << 3);
}

export function opcodeBX(Rm: number) {
  return (0b010001110 << 7) | (Rm << 3);
}

export function opcodeEORS(Rdn: number, Rm: number) {
  return (0b0100000001 << 6) | ((Rm & 0x7) << 3) | (Rdn & 0x7);
}

export function opcodeLDMIA(Rn: number, registers: number) {
  return (0b11001 << 11) | ((Rn & 0x7) << 8) | (registers & 0xff);
}

export function opcodeLDRreg(Rt: number, Rn: number, Rm: number) {
  return (0b0101100 << 9) | ((Rm & 0x7) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeLDRB(Rt: number, Rn: number, imm5: number) {
  return (0b01111 << 11) | ((imm5 & 0x1f) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeLDRsp(Rt: number, imm8: number) {
  return (0b10011 << 11) | ((Rt & 7) << 8) | ((imm8 >> 2) & 0xff);
}

export function opcodeLDRBreg(Rt: number, Rn: number, Rm: number) {
  return (0b0101110 << 9) | ((Rm & 0x7) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeLDRH(Rt: number, Rn: number, imm5: number) {
  return (0b10001 << 11) | (((imm5 >> 1) & 0xf) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeLDRHreg(Rt: number, Rn: number, Rm: number) {
  return (0b0101101 << 9) | ((Rm & 0x7) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeLDRSB(Rt: number, Rn: number, Rm: number) {
  return (0b0101011 << 9) | ((Rm & 0x7) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeLDRSH(Rt: number, Rn: number, Rm: number) {
  return (0b0101111 << 9) | ((Rm & 0x7) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeLSLSreg(Rdn: number, Rm: number) {
  return (0b0100000010 << 6) | ((Rm & 0x7) << 3) | (Rdn & 0x7);
}

export function opcodeLSRS(Rd: number, Rm: number, imm5: number) {
  return (0b00001 << 11) | ((imm5 & 0x1f) << 6) | ((Rm & 0x7) << 3) | (Rd & 0x7);
}

export function opcodeLSRSreg(Rdn: number, Rm: number) {
  return (0b0100000011 << 6) | ((Rm & 0x7) << 3) | (Rdn & 0x7);
}

export function opcodeMOV(Rd: number, Rm: number) {
  return (0b01000110 << 8) | ((Rd & 0x8 ? 1 : 0) << 7) | (Rm << 3) | (Rd & 0x7);
}

export function opcodeMOVS(Rd: number, imm8: number) {
  return (0b00100 << 11) | ((Rd & 0x7) << 8) | (imm8 & 0xff);
}

export function opcodeMRS(Rd: number, specReg: number) {
  return (
    ((0b1000 << 28) | ((Rd & 0xf) << 24) | ((specReg & 0xff) << 16) | 0b1111001111101111) >>> 0
  );
}

export function opcodeMSR(specReg: number, Rn: number) {
  return ((0b10001000 << 24) | ((specReg & 0xff) << 16) | (0b111100111000 << 4) | (Rn & 0xf)) >>> 0;
}

export function opcodeMULS(Rn: number, Rdm: number) {
  return (0b0100001101 << 6) | ((Rn & 7) << 3) | (Rdm & 7);
}

export function opcodeMVNS(Rd: number, Rm: number) {
  return (0b0100001111 << 6) | ((Rm & 7) << 3) | (Rd & 7);
}

export function opcodeORRS(Rn: number, Rm: number) {
  return (0b0100001100 << 6) | ((Rm & 0x7) << 3) | (Rn & 0x7);
}

export function opcodePOP(P: boolean, registerList: number) {
  return (0b1011110 << 9) | ((P ? 1 : 0) << 8) | registerList;
}

export function opcodeREV(Rd: number, Rn: number) {
  return (0b1011101000 << 6) | ((Rn & 0x7) << 3) | (Rd & 0x7);
}

export function opcodeRSBS(Rd: number, Rn: number) {
  return (0b0100001001 << 6) | ((Rn & 0x7) << 3) | (Rd & 0x7);
}

export function opcodeSBCS(Rn: number, Rm: number) {
  return (0b0100000110 << 6) | ((Rm & 0x7) << 3) | (Rn & 0x7);
}

export function opcodeSTMIA(Rn: number, registers: number) {
  return (0b11000 << 11) | ((Rn & 0x7) << 8) | (registers & 0xff);
}

export function opcodeSTR(Rt: number, Rm: number, imm5: number) {
  return (0b01100 << 11) | (((imm5 >> 2) & 0x1f) << 6) | ((Rm & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeSTRsp(Rt: number, imm8: number) {
  return (0b10010 << 11) | ((Rt & 7) << 8) | ((imm8 >> 2) & 0xff);
}

export function opcodeSTRreg(Rt: number, Rn: number, Rm: number) {
  return (0b0101000 << 9) | ((Rm & 0x7) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeSTRB(Rt: number, Rm: number, imm5: number) {
  return (0b01110 << 11) | ((imm5 & 0x1f) << 6) | ((Rm & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeSTRBreg(Rt: number, Rn: number, Rm: number) {
  return (0b0101010 << 9) | ((Rm & 0x7) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeSTRH(Rt: number, Rm: number, imm5: number) {
  return (0b10000 << 11) | (((imm5 >> 1) & 0x1f) << 6) | ((Rm & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeSTRHreg(Rt: number, Rn: number, Rm: number) {
  return (0b0101001 << 9) | ((Rm & 0x7) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeSUBS1(Rd: number, Rn: number, imm3: number) {
  return (0b0001111 << 9) | ((imm3 & 0x7) << 6) | ((Rn & 7) << 3) | (Rd & 7);
}

export function opcodeSUBS2(Rdn: number, imm8: number) {
  return (0b00111 << 11) | ((Rdn & 7) << 8) | (imm8 & 0xff);
}

export function opcodeSUBSreg(Rd: number, Rn: number, Rm: number) {
  return (0b0001101 << 9) | ((Rm & 0x7) << 6) | ((Rn & 7) << 3) | (Rd & 7);
}

export function opcodeSUBsp(imm: number) {
  return (0b101100001 << 7) | ((imm >> 2) & 0x7f);
}

export function opcodeSXTB(Rd: number, Rm: number) {
  return (0b1011001001 << 6) | ((Rm & 7) << 3) | (Rd & 7);
}

export function opcodeUXTB(Rd: number, Rm: number) {
  return (0b1011001011 << 6) | ((Rm & 7) << 3) | (Rd & 7);
}

export function opcodeUXTH(Rd: number, Rm: number) {
  return (0b1011001010 << 6) | ((Rm & 7) << 3) | (Rd & 7);
}
