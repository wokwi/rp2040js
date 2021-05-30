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

export function opcodeASRSreg(Rdn: number, Rm: number) {
  return (0b0100000100 << 6) | ((Rm & 0x7) << 3) | ((Rm & 0x7) << 3) | (Rdn & 0x7);
}

export function opcodeBT1(cond: number, imm8: number) {
  return (0b1101 << 12) | ((cond & 0xf) << 8) | ((imm8 >> 1) & 0x1ff);
}

export function opcodeBT2(imm11: number) {
  return (0b11100 << 11) | ((imm11 >> 1) & 0x7ff);
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

export function opcodeCMN(Rn: number, Rm: number) {
  return (0b0100001011 << 6) | ((Rm & 0x7) << 3) | (Rn & 0x7);
}

export function opcodeCMPimm(Rn: number, Imm8: number) {
  return (0b00101 << 11) | ((Rn & 0x7) << 8) | (Imm8 & 0xff);
}

export function opcodeCMPregT1(Rn: number, Rm: number) {
  return (0b0100001010 << 6) | ((Rm & 0x7) << 3) | (Rn & 0x7);
}

export function opcodeCMPregT2(Rn: number, Rm: number) {
  return (0b01000101 << 8) | (((Rn >> 3) & 0x1) << 7) | ((Rm & 0xf) << 3) | (Rn & 0x7);
}

export function opcodeDMBSY() {
  return 0x8f50f3bf;
}

export function opcodeDSBSY() {
  return 0x8f4ff3bf;
}

export function opcodeEORS(Rdn: number, Rm: number) {
  return (0b0100000001 << 6) | ((Rm & 0x7) << 3) | (Rdn & 0x7);
}

export function opcodeISBSY() {
  return 0x8f6ff3bf;
}

export function opcodeLDMIA(Rn: number, registers: number) {
  return (0b11001 << 11) | ((Rn & 0x7) << 8) | (registers & 0xff);
}

export function opcodeLDRreg(Rt: number, Rn: number, Rm: number) {
  return (0b0101100 << 9) | ((Rm & 0x7) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeLDRimm(Rt: number, Rn: number, imm5: number) {
  return (0b01101 << 11) | (((imm5 >> 2) & 0x1f) << 6) | ((Rn & 0x7) << 3) | (Rt & 0x7);
}

export function opcodeLDRlit(Rt: number, imm8: number) {
  return (0b01001 << 11) | ((imm8 >> 2) & 0xff) | ((Rt & 0x7) << 8);
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

export function opcodeLSLSimm(Rd: number, Rm: number, Imm5: number) {
  return (0b00000 << 11) | ((Imm5 & 0x1f) << 6) | ((Rm & 0x7) << 3) | (Rd & 0x7);
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

export function opcodeMOVSreg(Rd: number, Rm: number) {
  return (0b000000000 << 6) | ((Rm & 0x7) << 3) | (Rd & 0x7);
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

export function opcodeNOP() {
  return 0b1011111100000000;
}

export function opcodeORRS(Rn: number, Rm: number) {
  return (0b0100001100 << 6) | ((Rm & 0x7) << 3) | (Rn & 0x7);
}

export function opcodePOP(P: boolean, registerList: number) {
  return (0b1011110 << 9) | ((P ? 1 : 0) << 8) | registerList;
}

export function opcodePUSH(M: boolean, registerList: number) {
  return (0b1011010 << 9) | ((M ? 1 : 0) << 8) | registerList;
}

export function opcodeREV(Rd: number, Rn: number) {
  return (0b1011101000 << 6) | ((Rn & 0x7) << 3) | (Rd & 0x7);
}

export function opcodeREV16(Rd: number, Rn: number) {
  return (0b1011101001 << 6) | ((Rn & 0x7) << 3) | (Rd & 0x7);
}

export function opcodeREVSH(Rd: number, Rn: number) {
  return (0b1011101011 << 6) | ((Rn & 0x7) << 3) | (Rd & 0x7);
}

export function opcodeROR(Rdn: number, Rm: number) {
  return (0b0100000111 << 6) | ((Rm & 0x7) << 3) | (Rdn & 0x7);
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

export function opcodeSVC(imm8: number) {
  return (0b11011111 << 8) | (imm8 & 0xff);
}

export function opcodeSXTB(Rd: number, Rm: number) {
  return (0b1011001001 << 6) | ((Rm & 7) << 3) | (Rd & 7);
}

export function opcodeSXTH(Rd: number, Rm: number) {
  return (0b1011001000 << 6) | ((Rm & 7) << 3) | (Rd & 7);
}

export function opcodeTST(Rm: number, Rn: number) {
  return (0b0100001000 << 6) | ((Rn & 7) << 3) | (Rm & 7);
}

export function opcodeUXTB(Rd: number, Rm: number) {
  return (0b1011001011 << 6) | ((Rm & 7) << 3) | (Rd & 7);
}

export function opcodeUDF(imm8: number) {
  return ((0b11011110 << 8) | (imm8 & 0xff)) >>> 0;
}

export function opcodeUDF2(imm16: number) {
  const imm12 = imm16 & 0xfff;
  const imm4 = (imm16 >> 12) & 0xf;
  return ((0b111101111111 << 4) | imm4 | (0b1010 << 28) | (imm12 << 16)) >>> 0;
}

export function opcodeUXTH(Rd: number, Rm: number) {
  return (0b1011001010 << 6) | ((Rm & 7) << 3) | (Rd & 7);
}

export function opcodeWFI() {
  return 0b1011111100110000;
}

export function opcodeYIELD() {
  return 0b1011111100010000;
}
