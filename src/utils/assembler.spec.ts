import {
  opcodeADCS,
  opcodeADDS1,
  opcodeADDS2,
  opcodeADDsp2,
  opcodeADDSreg1,
  opcodeADR,
  opcodeANDS,
  opcodeBICS,
  opcodeBL,
  opcodeBLX,
  opcodeBX,
  opcodeLDMIA,
  opcodeLDRB,
  opcodeLDRH,
  opcodeLSRS,
  opcodeMOV,
  opcodeORRS,
  opcodePOP,
  opcodeRSBS,
  opcodeSBCS,
  opcodeSTMIA,
  opcodeSUBS1,
  opcodeSUBS2,
  opcodeSUBsp,
  opcodeSUBSreg,
  opcodeUXTB,
} from './assembler';

const r0 = 0;
const r1 = 1;
const r2 = 2;
const r3 = 3;
const r4 = 4;
const r5 = 5;
const r6 = 6;
const r7 = 7;
const r8 = 8;
const lr = 14;
const pc = 15;

describe('assembler', () => {
  it('should correctly encode an `adc r3, r0` instruction', () => {
    expect(opcodeADCS(r3, r0)).toEqual(0x4143);
  });

  it('should correctly encode an `add	sp, #12` instruction', () => {
    expect(opcodeADDsp2(12)).toEqual(0xb003);
  });

  it('should correctly encode an `adds r0, r3, #0` instruction', () => {
    expect(opcodeADDS1(r0, r3, 0)).toEqual(0x1c18);
  });

  it('should correctly encode an `adds r1, r1, r3` instruction', () => {
    expect(opcodeADDSreg1(r1, r1, r3)).toEqual(0x18c9);
  });

  it('should correctly encode an `adds r1, #1` instruction', () => {
    expect(opcodeADDS2(r1, 1)).toEqual(0x3101);
  });

  it('should correctly encode an `ands r5, r0` instruction', () => {
    expect(opcodeANDS(r5, r0)).toEqual(0x4005);
  });

  it('should correctly encode an `adr r4, #52` instruction', () => {
    expect(opcodeADR(r4, 52)).toEqual(0xa40d);
  });

  it('should correctly encode an `bics r0, r3` instruction', () => {
    expect(opcodeBICS(r0, r3)).toEqual(0x4398);
  });

  it('should correctly encode an `bl .-198` instruction', () => {
    expect(opcodeBL(-198)).toEqual(0xff9df7ff);
  });

  it('should correctly encode an `bl .+10` instruction', () => {
    expect(opcodeBL(10)).toEqual(0xf805f000);
  });

  it('should correctly encode an `bl .-3242` instruction', () => {
    expect(opcodeBL(-3242)).toEqual(0xf9abf7ff);
  });

  it('should correctly encode an `blx	r1` instruction', () => {
    expect(opcodeBLX(r1)).toEqual(0x4788);
  });

  it('should correctly encode an `bx lr` instruction', () => {
    expect(opcodeBX(lr)).toEqual(0x4770);
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

  it('should correctly encode an `ldrh r3, [r0, #2]` instruction', () => {
    expect(opcodeLDRH(r3, r0, 2)).toEqual(0x8843);
  });

  it('should correctly encode an `mov r3, r8` instruction', () => {
    expect(opcodeMOV(r3, r8)).toEqual(0x4643);
  });

  it('should correctly encode an `prrs r3, r0` instruction', () => {
    expect(opcodeORRS(r3, r0)).toEqual(0x4303);
  });

  it('should correctly encode an `pop {r0, r1, pc}` instruction', () => {
    expect(opcodePOP(true, (1 << r0) | (1 << r1))).toEqual(0xbd03);
  });

  it('should correctly encode an `rsbs r0, r3` instruction', () => {
    expect(opcodeRSBS(r0, r3)).toEqual(0x4258);
  });

  it('should correctly encode an `sbcs r0, r3` instruction', () => {
    expect(opcodeSBCS(r0, r3)).toEqual(0x4198);
  });

  it('should correctly encode an `stmia	r2!, {r0}` instruction', () => {
    expect(opcodeSTMIA(r2, 1 << r0)).toEqual(0xc201);
  });

  it('should correctly encode an `sub	sp, #12` instruction', () => {
    expect(opcodeSUBsp(12)).toEqual(0xb083);
  });

  it('should correctly encode an `subs r3, r0, #1` instruction', () => {
    expect(opcodeSUBS1(r3, r0, 1)).toEqual(0x1e43);
  });

  it('should correctly encode an `subs r1, r1, r0` instruction', () => {
    expect(opcodeSUBSreg(r1, r1, r0)).toEqual(0x1a09);
  });

  it('should correctly encode an `subs r3, #13` instruction', () => {
    expect(opcodeSUBS2(r3, 13)).toEqual(0x3b0d);
  });

  it('should correctly encode an `uxtb r3, r3` instruction', () => {
    expect(opcodeUXTB(r3, r3)).toEqual(0xb2db);
  });
});
