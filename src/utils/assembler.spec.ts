import {
  opcodeADCS,
  opcodeADDS2,
  opcodeLDRB,
  opcodeRSBS,
  opcodeSUBS2,
  opcodeUXTB,
} from './assembler';

const r0 = 0;
const r1 = 1;
const r3 = 3;

describe('assembler', () => {
  //
  it('should correctly encode an `adc r3, r0` instruction', () => {
    expect(opcodeADCS(r3, r0)).toEqual(0x4143);
  });

  it('should correctly encode an `adds r1, #1` instruction', () => {
    expect(opcodeADDS2(r1, 1)).toEqual(0x3101);
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
});
