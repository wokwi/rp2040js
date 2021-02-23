import {
  opcodeADCS,
  opcodeADDS2,
  opcodeBL,
  opcodeBX,
  opcodeLDMIA,
  opcodeLDRB,
  opcodeLSRS,
  opcodeRSBS,
  opcodeSUBS2,
  opcodeUXTB,
} from './assembler';

const r0 = 0;
const r1 = 1;
const r2 = 2;
const r3 = 3;

describe('assembler', () => {
  //
  it('should correctly encode an `adc r3, r0` instruction', () => {
    expect(opcodeADCS(r3, r0)).toEqual(0x4143);
  });

  it('should correctly encode an `adds r1, #1` instruction', () => {
    expect(opcodeADDS2(r1, 1)).toEqual(0x3101);
  });

  it('should correctly encode an `bl .-198` instruction', () => {
    expect(opcodeBL(-198)).toEqual(0xff9df7ff);
  });

  it('should correctly encode an `bl .+10` instruction', () => {
    expect(opcodeBL(10)).toEqual(0xf805f000);
  });

  it('should correctly encode an `ldmia	r0!, {r1, r2}` instruction', () => {
    expect(opcodeLDMIA(r0, (1 << r1) | (1 << r2))).toEqual(0xc806);
  });

  it('should correctly encode an `lsrs r1, r1, #1` instruction', () => {
    expect(opcodeLSRS(r1, r1, 1)).toEqual(0x0849);
  });

  it('should correctly encode an `ldrb r0, [r1, #0]` instruction', () => {
    expect(opcodeLDRB(r0, r1, 0)).toEqual(0x7808);
  });

  it('should correctly encode an `rsbs r0, r3` instruction', () => {
    expect(opcodeRSBS(r0, r3)).toEqual(0x4258);
  });

  it('should correctly encode an `subs r3, #13` instruction', () => {
    expect(opcodeSUBS2(r3, 13)).toEqual(0x3b0d);
  });

  it('should correctly encode an `uxtb r3, r3` instruction', () => {
    expect(opcodeUXTB(r3, r3)).toEqual(0xb2db);
  });

  it('should correctly encode an `bx lr` instruction', () => {
    expect(opcodeBX(14)).toEqual(0x4770);
  });

});
