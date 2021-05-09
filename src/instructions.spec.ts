import { RAM_START_ADDRESS, RP2040 } from './rp2040';
import {
  opcodeADCS,
  opcodeADDreg,
  opcodeADDS1,
  opcodeADDS2,
  opcodeADDsp2,
  opcodeADDspPlusImm,
  opcodeADDSreg,
  opcodeADR,
  opcodeANDS,
  opcodeASRS,
  opcodeASRSreg,
  opcodeBICS,
  opcodeBL,
  opcodeBLX,
  opcodeBX,
  opcodeCMN,
  opcodeEORS,
  opcodeLDMIA,
  opcodeLDRB,
  opcodeLDRBreg,
  opcodeLDRH,
  opcodeLDRHreg,
  opcodeLDRreg,
  opcodeLDRSB,
  opcodeLDRSH,
  opcodeLDRsp,
  opcodeLSLSreg,
  opcodeLSRS,
  opcodeLSRSreg,
  opcodeMOV,
  opcodeMOVS,
  opcodeMRS,
  opcodeMSR,
  opcodeMULS,
  opcodeMVNS,
  opcodeNOP,
  opcodeORRS,
  opcodePOP,
  opcodeREV,
  opcodeREV16,
  opcodeREVSH,
  opcodeROR,
  opcodeRSBS,
  opcodeSBCS,
  opcodeSTMIA,
  opcodeSTR,
  opcodeSTRB,
  opcodeSTRBreg,
  opcodeSTRH,
  opcodeSTRHreg,
  opcodeSTRreg,
  opcodeSTRsp,
  opcodeSUBS1,
  opcodeSUBS2,
  opcodeSUBsp,
  opcodeSUBSreg,
  opcodeSVC,
  opcodeSXTB,
  opcodeSXTH,
  opcodeUDF2,
  opcodeUXTB,
  opcodeUXTH,
  opcodeWFI,
  opcodeYIELD,
} from './utils/assembler';

const r0 = 0;
const r1 = 1;
const r2 = 2;
const r3 = 3;
const r4 = 4;
const r5 = 5;
const r6 = 6;
const r7 = 7;
const r8 = 8;
const ip = 12;
const sp = 13;
const lr = 14;
const pc = 15;

const VTOR = 0xe000ed08;
const EXC_SVCALL = 11;

describe('Cortex-M0+ Instruction Set', () => {
  it('should execute `adcs r5, r4` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeADCS(r5, r4);
    rp2040.registers[r4] = 55;
    rp2040.registers[r5] = 66;
    rp2040.C = true;
    rp2040.executeInstruction();
    expect(rp2040.registers[r5]).toEqual(122);
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(false);
    expect(rp2040.V).toEqual(false);
  });

  it('should execute `adcs r5, r4` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeADCS(r5, r4);
    rp2040.registers[r4] = 0x7fffffff; // Max signed INT32
    rp2040.registers[r5] = 0;
    rp2040.C = true;
    rp2040.executeInstruction();
    expect(rp2040.registers[r5]).toEqual(0x80000000);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(false);
    expect(rp2040.V).toEqual(true);
  });

  it('should execute a `add sp, 0x10` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.SP = 0x10000040;
    rp2040.flash16[0] = opcodeADDsp2(0x10);
    rp2040.executeInstruction();
    expect(rp2040.SP).toEqual(0x10000050);
  });

  it('should execute a `add r1, sp, #4` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.SP = 0x55;
    rp2040.flash16[0] = opcodeADDspPlusImm(r1, 0x10);
    rp2040.registers[1] = 0;
    rp2040.executeInstruction();
    expect(rp2040.SP).toEqual(0x55);
    expect(rp2040.registers[1]).toEqual(0x65);
  });

  it('should execute `adds r1, r2, #3` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeADDS1(r1, r2, 3);
    rp2040.registers[r2] = 2;
    rp2040.executeInstruction();
    expect(rp2040.registers[r1]).toEqual(5);
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(false);
    expect(rp2040.V).toEqual(false);
  });

  it('should execute `adds r1, #1` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeADDS2(r1, 1);
    rp2040.registers[r1] = 0xffffffff;
    rp2040.executeInstruction();
    expect(rp2040.registers[r1]).toEqual(0);
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(true);
    expect(rp2040.C).toEqual(true);
    expect(rp2040.V).toEqual(false);
  });

  it('should execute `adds r1, r2, r7` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeADDSreg(r1, r2, r7);
    rp2040.registers[r2] = 2;
    rp2040.registers[r7] = 27;
    rp2040.executeInstruction();
    expect(rp2040.registers[r1]).toEqual(29);
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(false);
    expect(rp2040.V).toEqual(false);
  });

  it('should execute `add r1, ip` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeADDreg(r1, ip);
    rp2040.registers[r1] = 66;
    rp2040.registers[ip] = 44;
    rp2040.executeInstruction();
    expect(rp2040.registers[r1]).toEqual(110);
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(false);
    expect(rp2040.V).toEqual(false);
  });

  it('should execute `add sp, r8` instruction and not update the flags', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.SP = 0x20030000;
    rp2040.Z = true;
    rp2040.flash16[0] = opcodeADDreg(sp, r8);
    rp2040.registers[r8] = 0x11;
    rp2040.executeInstruction();
    expect(rp2040.SP).toEqual(0x20030011);
    expect(rp2040.Z).toEqual(true); // assert it didn't update the flags
  });

  it('should execute `add pc, r8` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeADDreg(pc, r8);
    rp2040.registers[r8] = 0x11;
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000014);
  });

  it('should execute `adr r4, #0x50` instruction and set the overflow flag correctly', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeADR(r4, 0x50);
    rp2040.executeInstruction();
    expect(rp2040.registers[r4]).toEqual(0x10000054);
  });

  it('should execute `ands r5, r0` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeANDS(r5, r0);
    rp2040.registers[r5] = 0xffff0000;
    rp2040.registers[r0] = 0xf00fffff;
    rp2040.executeInstruction();
    expect(rp2040.registers[r5]).toEqual(0xf00f0000);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
  });

  it('should execute an `asrs r3, r2, #31` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeASRS(r3, r2, 31);
    rp2040.registers[r2] = 0x80000000;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0xffffffff);
    expect(rp2040.PC).toEqual(0x10000002);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(false);
  });

  it('should execute an `asrs r3, r2, #0` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeASRS(r3, r2, 0);
    rp2040.registers[r2] = 0x80000000;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0xffffffff);
    expect(rp2040.PC).toEqual(0x10000002);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(true);
  });

  it('should execute an `asrs r3, r4` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeASRSreg(r3, r4);
    rp2040.registers[r3] = 0x80000040;
    rp2040.registers[r4] = 0xff500007;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0xff000000);
    expect(rp2040.PC).toEqual(0x10000002);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(true);
  });

  it('should execute `bics r0, r3` correctly', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.registers[r0] = 0xff;
    rp2040.registers[r3] = 0x0f;
    rp2040.flash16[0] = opcodeBICS(r0, r3);
    rp2040.executeInstruction();
    expect(rp2040.registers[r0]).toEqual(0xf0);
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(false);
  });

  it('should execute `bics r0, r3` instruction and set the negative flag correctly', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.registers[r0] = 0xffffffff;
    rp2040.registers[r3] = 0x0000ffff;
    rp2040.flash16[0] = opcodeBICS(r0, r3);
    rp2040.executeInstruction();
    expect(rp2040.registers[r0]).toEqual(0xffff0000);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
  });

  it('should execute `bl 0x34` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flashView.setUint32(0, opcodeBL(0x34), true);
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000038);
    expect(rp2040.LR).toEqual(0x10000005);
  });

  it('should execute `bl -0x10` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flashView.setUint32(0, opcodeBL(-0x10), true);
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000004 - 0x10);
    expect(rp2040.LR).toEqual(0x10000005);
  });

  it('should execute `bl -3242` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flashView.setUint32(0, opcodeBL(-3242), true);
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000004 - 3242);
    expect(rp2040.LR).toEqual(0x10000005);
  });

  it('should execute `blx r3` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.registers[3] = 0x10000201;
    rp2040.flashView.setUint32(0, opcodeBLX(r3), true);
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000200);
    expect(rp2040.LR).toEqual(0x10000003);
  });

  it('should execute a `b.n .-20` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000 + 9 * 2;
    rp2040.flash16[9] = 0xe7f6; // b.n .-20
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000002);
  });

  it('should execute a `bne.n .-6` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000 + 9 * 2;
    rp2040.Z = false;
    rp2040.flash16[9] = 0xd1fc; // bne.n .-6
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x1000000e);
  });

  it('should execute `bx lr` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.LR = 0x10000200;
    rp2040.flashView.setUint32(0, opcodeBX(lr), true);
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000200);
  });

  it('should execute an `cmn r5, r2` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeCMN(r7, r2);
    rp2040.registers[r2] = 1;
    rp2040.registers[r7] = -2;
    rp2040.executeInstruction();
    expect(rp2040.registers[r2]).toEqual(1);
    expect(rp2040.registers[r7]).toEqual(-2 >>> 0);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(false);
    expect(rp2040.V).toEqual(false);
  });

  it('should execute an `cmp r5, #66` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0x2d42; // cmp r5, #66
    rp2040.registers[r5] = 60;
    rp2040.executeInstruction();
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(false);
    expect(rp2040.V).toEqual(false);
  });

  it('should execute an `cmp r5, r0` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0x4285; // cmp r5, r0
    rp2040.registers[r5] = 60;
    rp2040.registers[r0] = 56;
    rp2040.executeInstruction();
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(true);
    expect(rp2040.V).toEqual(false);
  });

  it('should execute an `cmp ip, r6` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0x45b4; // cmp ip (r12), r6
    rp2040.registers[ip] = 60;
    rp2040.registers[r6] = 56;
    rp2040.executeInstruction();
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(true);
    expect(rp2040.V).toEqual(false);
  });

  it('should correctly decode a `dmb sy` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0xf3bf; // DMB SY
    rp2040.flash16[1] = 0x8f50; // ...
    rp2040.executeInstruction();
    expect(rp2040.PC).toBe(0x10000004);
  });

  it('should correctly decode a `dsb sy` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0xf3bf; // DSB SY
    rp2040.flash16[1] = 0x8f4f; // ...
    rp2040.executeInstruction();
    expect(rp2040.PC).toBe(0x10000004);
  });

  it('should execute an `eors r1, r3` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeEORS(r1, r3);
    rp2040.registers[r1] = 0xf0f0f0f0;
    rp2040.registers[r3] = 0x08ff3007;
    rp2040.executeInstruction();
    expect(rp2040.registers[r1]).toEqual(0xf80fc0f7);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
  });

  it('should correctly decode a `isb sy` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0xf3bf; // ISB SY
    rp2040.flash16[1] = 0x8f6f; // ...
    rp2040.executeInstruction();
    expect(rp2040.PC).toBe(0x10000004);
  });

  it('should execute a `mov r3, r8` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeMOV(r3, r8);
    rp2040.registers[r8] = 55;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(55);
  });

  it('should execute a `mov r3, pc` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeMOV(r3, pc);
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0x10000004);
  });

  it('should execute a `muls r0, r2` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeMULS(r0, r2);
    rp2040.registers[r0] = 5;
    rp2040.registers[r2] = 1000000;
    rp2040.executeInstruction();
    expect(rp2040.registers[r2]).toEqual(5000000);
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(false);
  });

  it('should execute a muls instruction with large 32-bit numbers and produce the correct result', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeMULS(r0, r2);
    rp2040.registers[r0] = 2654435769;
    rp2040.registers[r2] = 340573321;
    rp2040.executeInstruction();
    expect(rp2040.registers[r2]).toEqual(1);
  });

  it('should execute a `muls r0, r2` instruction and set the Z flag when the result is zero', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeMULS(r0, r2);
    rp2040.registers[r0] = 0;
    rp2040.registers[r2] = 1000000;
    rp2040.executeInstruction();
    expect(rp2040.registers[r2]).toEqual(0);
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(true);
  });

  it('should execute a `muls r0, r2` instruction and set the N flag when the result is negative', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeMULS(r0, r2);
    rp2040.registers[r0] = -1;
    rp2040.registers[r2] = 1000000;
    rp2040.executeInstruction();
    expect(rp2040.registers[r2]).toEqual(-1000000 >>> 0);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
  });

  it('should execute a `mvns r4, r3` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeMVNS(r4, r3);
    rp2040.registers[r3] = 0x11115555;
    rp2040.executeInstruction();
    expect(rp2040.registers[r4]).toEqual(0xeeeeaaaa);
    expect(rp2040.Z).toBe(false);
    expect(rp2040.N).toBe(true);
  });

  it('should execute a `nop` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeNOP();
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000002);
  });

  it('should execute `orrs r5, r0` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeORRS(r5, r0);
    rp2040.registers[r5] = 0xf00f0000;
    rp2040.registers[r0] = 0xf000ffff;
    rp2040.executeInstruction();
    expect(rp2040.registers[r5]).toEqual(0xf00fffff);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
  });

  it('should execute a `pop pc, {r4, r5, r6}` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.SP = RAM_START_ADDRESS + 0xf0;
    rp2040.flash16[0] = opcodePOP(true, (1 << r4) | (1 << r5) | (1 << r6));
    rp2040.sram[0xf0] = 0x40;
    rp2040.sram[0xf4] = 0x50;
    rp2040.sram[0xf8] = 0x60;
    rp2040.sram[0xfc] = 0x42;
    rp2040.executeInstruction();
    expect(rp2040.SP).toEqual(RAM_START_ADDRESS + 0x100);
    // assert that the values of r4, r5, r6, pc were poped from the stack correctly
    expect(rp2040.registers[r4]).toEqual(0x40);
    expect(rp2040.registers[r5]).toEqual(0x50);
    expect(rp2040.registers[r6]).toEqual(0x60);
    expect(rp2040.PC).toEqual(0x42);
  });

  it('should execute a `push {r4, r5, r6, lr}` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.SP = RAM_START_ADDRESS + 0x100;
    rp2040.flash16[0] = 0xb570; // push {r4, r5, r6, lr}
    rp2040.registers[r4] = 0x40;
    rp2040.registers[r5] = 0x50;
    rp2040.registers[r6] = 0x60;
    rp2040.LR = 0x42;
    rp2040.executeInstruction();
    // assert that the values of r4, r5, r6, lr were pushed into the stack
    expect(rp2040.SP).toEqual(RAM_START_ADDRESS + 0xf0);
    expect(rp2040.sram[0xf0]).toEqual(0x40);
    expect(rp2040.sram[0xf4]).toEqual(0x50);
    expect(rp2040.sram[0xf8]).toEqual(0x60);
    expect(rp2040.sram[0xfc]).toEqual(0x42);
  });

  it('should execute a `mrs r0, ipsr` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flashView.setUint32(0, opcodeMRS(r0, 5), true); // 5 === ipsr
    rp2040.registers[r0] = 55;
    rp2040.executeInstruction();
    expect(rp2040.registers[r0]).toEqual(0);
    expect(rp2040.PC).toEqual(0x10000004);
  });

  it('should execute a `msr ipsr, r0` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flashView.setUint32(0, opcodeMSR(8, r0), true); // 5 === ipsr
    rp2040.registers[r0] = 0x1234;
    rp2040.executeInstruction();
    expect(rp2040.SP).toEqual(0x1234);
    expect(rp2040.PC).toEqual(0x10000004);
  });

  it('should execute a `movs r5, #128` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeMOVS(r5, 128);
    rp2040.executeInstruction();
    expect(rp2040.registers[r5]).toEqual(128);
    expect(rp2040.PC).toEqual(0x10000002);
  });

  it('should execute a `ldmia r0!, {r1, r2}` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLDMIA(r0, (1 << r1) | (1 << r2));
    rp2040.registers[r0] = 0x20000000;
    rp2040.sramView.setUint32(0, 0xf00df00d, true);
    rp2040.sramView.setUint32(4, 0x4242, true);
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000002);
    expect(rp2040.registers[r0]).toEqual(0x20000008);
    expect(rp2040.registers[r1]).toEqual(0xf00df00d);
    expect(rp2040.registers[r2]).toEqual(0x4242);
  });

  it('should execute a `ldmia r5!, {r5}` instruction without writing back the address to r5', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLDMIA(r5, 1 << r5);
    rp2040.registers[r5] = 0x20000000;
    rp2040.sramView.setUint32(0, 0xf00df00d, true);
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000002);
    expect(rp2040.registers[r5]).toEqual(0xf00df00d);
  });

  it('should execute an `ldr r0, [pc, #148]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0x4825; // ldr r0, [pc, #148]
    rp2040.flash[152] = 0x42;
    rp2040.flash.fill(0, 153, 156);
    rp2040.executeInstruction();
    expect(rp2040.registers[r0]).toEqual(0x42);
    expect(rp2040.PC).toEqual(0x10000002);
  });

  it('should execute an `ldr r3, [r2, #24]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0x6993; // ldr r3, [r2, #24]
    rp2040.registers[r2] = 0x20000000;
    rp2040.sram[24] = 0x55;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0x55);
  });

  it('should execute an `ldr r3, [sp, #12]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.SP = 0x20000000;
    rp2040.flash16[0] = opcodeLDRsp(r3, 12);
    rp2040.sram[12] = 0x55;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0x55);
  });

  it('should execute an `ldr r3, [r5, r6]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLDRreg(r3, r5, r6);
    rp2040.registers[r5] = 0x20000000;
    rp2040.registers[r6] = 0x8;
    rp2040.sram[8] = 0x11;
    rp2040.sram[9] = 0x42;
    rp2040.sram[10] = 0x55;
    rp2040.sram[11] = 0xff;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0xff554211);
  });

  it('should execute an `ldrb r4, [r2, 5]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLDRB(r4, r2, 5);
    rp2040.registers[r2] = 0x20000000;
    rp2040.sram[5] = 0x66;
    rp2040.sram[6] = 0x77;
    rp2040.executeInstruction();
    expect(rp2040.registers[r4]).toEqual(0x66);
  });

  it('should execute an `ldrb r3, [r5, r6]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLDRBreg(r3, r5, r6);
    rp2040.registers[r5] = 0x20000000;
    rp2040.registers[r6] = 0x8;
    rp2040.sram[8] = 0x11;
    rp2040.sram[9] = 0x42;
    rp2040.sram[10] = 0x55;
    rp2040.sram[11] = 0xff;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0x11);
  });

  it('should execute an `ldrh r3, [r7, #4]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLDRH(r3, r7, 4);
    rp2040.registers[r7] = 0x20000000;
    rp2040.sram[4] = 0x66;
    rp2040.sram[5] = 0x77;
    rp2040.sram[6] = 0xff;
    rp2040.sram[7] = 0xff;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0x7766);
  });

  it('should execute an `ldrh r3, [r7, #6]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLDRH(r3, r7, 6);
    rp2040.registers[r7] = 0x20000000;
    rp2040.sram[4] = 0x66;
    rp2040.sram[5] = 0x77;
    rp2040.sram[6] = 0x44;
    rp2040.sram[7] = 0x33;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0x3344);
  });

  it('should execute an `ldrh r3, [r5, r6]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLDRHreg(r3, r5, r6);
    rp2040.registers[r5] = 0x20000000;
    rp2040.registers[r6] = 0x8;
    rp2040.sram[8] = 0x11;
    rp2040.sram[9] = 0x42;
    rp2040.sram[10] = 0x55;
    rp2040.sram[11] = 0xff;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0x4211);
  });

  it('should execute an `ldrsb r5, [r3, r5]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLDRSB(r5, r3, r5);
    rp2040.registers[r3] = 0x20000000;
    rp2040.registers[r5] = 6;
    rp2040.sram[6] = 0x85;
    rp2040.executeInstruction();
    expect(rp2040.registers[r5]).toEqual(0xffffff85);
  });

  it('should execute an `ldrsh r5, [r3, r5]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLDRSH(r5, r3, r5);
    rp2040.registers[r3] = 0x20000000;
    rp2040.registers[r5] = 6;
    rp2040.sram[6] = 0x55;
    rp2040.sram[7] = 0xf0;
    rp2040.executeInstruction();
    expect(rp2040.registers[r5]).toEqual(0xfffff055);
  });

  it('should execute a `udf 1` instruction', () => {
    const breakMock = jest.fn();
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0xde01; // udf 1
    rp2040.onBreak = breakMock;
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000002);
    expect(breakMock).toHaveBeenCalledWith(1);
  });

  it('should execute a `udf.w #0` (T2 encoding) instruction', () => {
    const breakMock = jest.fn();
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flashView.setUint32(0, opcodeUDF2(0), true);
    rp2040.onBreak = breakMock;
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000004);
    expect(breakMock).toHaveBeenCalledWith(0);
  });

  it('should execute a `lsls r5, r5, #18` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0x04ad; // lsls r5, r5, #18
    rp2040.registers[r5] = 0b00000000000000000011;
    rp2040.executeInstruction();
    expect(rp2040.registers[r5]).toEqual(0b11000000000000000000);
    expect(rp2040.PC).toEqual(0x10000002);
    expect(rp2040.C).toEqual(false);
  });

  it('should execute a `lsls r5, r0` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLSLSreg(r5, r0);
    rp2040.registers[r5] = 0b00000000000000000011;
    rp2040.registers[r0] = 0xff003302; // bottom byte: 02
    rp2040.executeInstruction();
    expect(rp2040.registers[r5]).toEqual(0b00000000000000001100);
    expect(rp2040.PC).toEqual(0x10000002);
    expect(rp2040.C).toEqual(false);
  });

  it('should execute a `lsls r5, r5, #18` instruction with carry', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0x04ad; // lsls r5, r5, #18
    rp2040.registers[r5] = 0x00004001;
    rp2040.executeInstruction();
    expect(rp2040.registers[r5]).toEqual(0x40000);
    expect(rp2040.C).toEqual(true);
  });

  it('should execute a `lsrs r5, r0` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLSRSreg(r5, r0);
    rp2040.registers[r5] = 0xff00000f;
    rp2040.registers[r0] = 0xff003302; // Shift amount: 02
    rp2040.executeInstruction();
    expect(rp2040.registers[r5]).toEqual(0x3fc00003);
    expect(rp2040.PC).toEqual(0x10000002);
    expect(rp2040.C).toEqual(true);
  });

  it('should execute a `lsrs r1, r1, #1` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLSRS(r1, r1, 1);
    rp2040.registers[r1] = 0b10;
    rp2040.executeInstruction();
    expect(rp2040.registers[r1]).toEqual(0b1);
    expect(rp2040.PC).toEqual(0x10000002);
    expect(rp2040.C).toEqual(false);
  });

  it('should execute a `lsrs r1, r1, 0` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeLSRS(r1, r1, 0);
    rp2040.registers[r1] = 0xffffffff;
    rp2040.executeInstruction();
    expect(rp2040.registers[r1]).toEqual(0);
    expect(rp2040.PC).toEqual(0x10000002);
    expect(rp2040.C).toEqual(true);
  });

  it('should execute a `movs r6, r5` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0x002e; // movs r6, r5
    rp2040.registers[r5] = 0x50;
    rp2040.executeInstruction();
    expect(rp2040.registers[r6]).toEqual(0x50);
  });

  it('should execute a `rsbs r0, r3` instruction', () => {
    // This instruction is also called `negs`
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeRSBS(r0, r3);
    rp2040.registers[r3] = 100;
    rp2040.executeInstruction();
    expect(rp2040.registers[r0] | 0).toEqual(-100);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(false);
    expect(rp2040.V).toEqual(false);
  });

  it('should execute a `rev r3, r1` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeREV(r2, r3);
    rp2040.registers[r3] = 0x11223344;
    rp2040.executeInstruction();
    expect(rp2040.registers[r2]).toEqual(0x44332211);
  });

  it('should execute a `rev16 r0, r5` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeREV16(r0, r5);
    rp2040.registers[r5] = 0x11223344;
    rp2040.executeInstruction();
    expect(rp2040.registers[r0]).toEqual(0x22114433);
  });

  it('should execute a `revsh r1, r2` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeREVSH(r1, r2);
    rp2040.registers[r2] = 0xeeaa55f0;
    rp2040.executeInstruction();
    expect(rp2040.registers[r1]).toEqual(0xfffff055);
  });

  it('should execute a `ror r5, r3` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeROR(r5, r3);
    rp2040.registers[r5] = 0x12345678;
    rp2040.registers[r3] = 0x2004;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0x2004);
    expect(rp2040.registers[r5]).toEqual(0x81234567);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(true);
  });

  it('should execute a `ror r5, r3` instruction when r3 > 32', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeROR(r5, r3);
    rp2040.registers[r5] = 0x12345678;
    rp2040.registers[r3] = 0x2044;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0x2044);
    expect(rp2040.registers[r5]).toEqual(0x81234567);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(true);
  });

  it('should execute a `rsbs r0, r3` instruction', () => {
    // This instruction is also called `negs`
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeRSBS(r0, r3);
    rp2040.registers[r3] = 0;
    rp2040.executeInstruction();
    expect(rp2040.registers[r0] | 0).toEqual(0);
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(true);
    expect(rp2040.C).toEqual(true);
    expect(rp2040.V).toEqual(false);
  });

  it('should execute a `sbcs r0, r3` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeSBCS(r0, r3);
    rp2040.registers[r0] = 100;
    rp2040.registers[r3] = 55;
    rp2040.C = false;
    rp2040.executeInstruction();
    expect(rp2040.registers[r0]).toEqual(44);
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(true);
    expect(rp2040.V).toEqual(false);
  });

  it('should execute a `sdmia r0!, {r1, r2}` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeSTMIA(r0, (1 << r1) | (1 << r2));
    rp2040.registers[r0] = 0x20000000;
    rp2040.registers[r1] = 0xf00df00d;
    rp2040.registers[r2] = 0x4242;
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000002);
    expect(rp2040.registers[r0]).toEqual(0x20000008);
    expect(rp2040.sramView.getUint32(0, true)).toEqual(0xf00df00d);
    expect(rp2040.sramView.getUint32(4, true)).toEqual(0x4242);
  });

  it('should execute a `str r6, [r4, #20]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeSTR(r6, r4, 20);
    rp2040.registers[r4] = RAM_START_ADDRESS + 0x20;
    rp2040.registers[r6] = 0xf00d;
    rp2040.executeInstruction();
    expect(rp2040.sramView.getUint32(0x20 + 20, true)).toEqual(0xf00d);
    expect(rp2040.PC).toEqual(0x10000002);
  });

  it('should execute a `str r6, [r4, r5]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeSTRreg(r6, r4, r5);
    rp2040.registers[r4] = RAM_START_ADDRESS + 0x20;
    rp2040.registers[r5] = 20;
    rp2040.registers[r6] = 0xf00d;
    rp2040.executeInstruction();
    expect(rp2040.sramView.getUint32(0x20 + 20, true)).toEqual(0xf00d);
    expect(rp2040.PC).toEqual(0x10000002);
  });

  it('should execute an `str r3, [sp, #12]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.SP = 0x20000000;
    rp2040.flash16[0] = opcodeSTRsp(r3, 12);
    rp2040.registers[r3] = 0xaa55;
    rp2040.executeInstruction();
    expect(rp2040.sram[12]).toEqual(0x55);
    expect(rp2040.sram[13]).toEqual(0xaa);
  });

  it('should execute a `strb r6, [r4, #20]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.sramView.setUint32(0x20, 0xf5f4f3f2, true);
    rp2040.flash16[0] = opcodeSTRB(r6, r4, 0x1);
    rp2040.registers[r4] = RAM_START_ADDRESS + 0x20;
    rp2040.registers[r6] = 0xf055;
    rp2040.executeInstruction();
    // assert that the 2nd byte (at 0x21) changed to 0x55
    expect(rp2040.sramView.getUint32(0x20, true)).toEqual(0xf5f455f2);
    expect(rp2040.PC).toEqual(0x10000002);
  });

  it('should execute a `strb r6, [r4, r5]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.sramView.setUint32(0x20, 0xf5f4f3f2, true);
    rp2040.flash16[0] = opcodeSTRBreg(r6, r4, r5);
    rp2040.registers[r4] = RAM_START_ADDRESS + 0x20;
    rp2040.registers[r5] = 1;
    rp2040.registers[r6] = 0xf055;
    rp2040.executeInstruction();
    // assert that the 2nd byte (at 0x21) changed to 0x55
    expect(rp2040.sramView.getUint32(0x20, true)).toEqual(0xf5f455f2);
    expect(rp2040.PC).toEqual(0x10000002);
  });

  it('should execute a `strh r6, [r4, #20]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.sramView.setUint32(0x20, 0xf5f4f3f2, true);
    rp2040.flash16[0] = opcodeSTRH(r6, r4, 0x2);
    rp2040.registers[r4] = RAM_START_ADDRESS + 0x20;
    rp2040.registers[r6] = 0x6655;
    rp2040.executeInstruction();
    // assert that the 3rd/4th byte (at 0x22) changed to 0x6655
    expect(rp2040.sramView.getUint32(0x20, true)).toEqual(0x6655f3f2);
    expect(rp2040.PC).toEqual(0x10000002);
  });

  it('should execute a `strh r6, [r4, r1]` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.sramView.setUint32(0x20, 0xf5f4f3f2, true);
    rp2040.flash16[0] = opcodeSTRHreg(r6, r4, r1);
    rp2040.registers[r4] = RAM_START_ADDRESS + 0x20;
    rp2040.registers[r1] = 2;
    rp2040.registers[r6] = 0x6655;
    rp2040.executeInstruction();
    // assert that the 3rd/4th byte (at 0x22) changed to 0x6655
    expect(rp2040.sramView.getUint32(0x20, true)).toEqual(0x6655f3f2);
    expect(rp2040.PC).toEqual(0x10000002);
  });

  it('should execute a `sub sp, 0x10` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.SP = 0x10000040;
    rp2040.flash16[0] = opcodeSUBsp(0x10);
    rp2040.executeInstruction();
    expect(rp2040.SP).toEqual(0x10000030);
  });

  it('should execute a `subs r1, #1` instruction with overflow', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeSUBS2(r1, 1);
    rp2040.registers[r1] = -0x80000000;
    rp2040.executeInstruction();
    expect(rp2040.registers[r1]).toEqual(0x7fffffff);
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(true);
    expect(rp2040.V).toEqual(true);
  });

  it('should execute a `subs r5, r3, 5` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeSUBS1(r5, r3, 5);
    rp2040.registers[r3] = 0;
    rp2040.executeInstruction();
    expect(rp2040.registers[r5] | 0).toEqual(-5);
    expect(rp2040.N).toEqual(true);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(false);
    expect(rp2040.V).toEqual(false);
  });

  it('should execute a `subs r5, r3, r2` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeSUBSreg(r5, r3, r2);
    rp2040.registers[r3] = 6;
    rp2040.registers[r2] = 5;
    rp2040.executeInstruction();
    expect(rp2040.registers[r5]).toEqual(1);
    expect(rp2040.N).toEqual(false);
    expect(rp2040.Z).toEqual(false);
    expect(rp2040.C).toEqual(true);
    expect(rp2040.V).toEqual(false);
  });

  it('should raise an SVCALL exception when `svc` instruction runs', () => {
    const SVCALL_HANDLER = 0x10002000;
    const rp2040 = new RP2040();
    rp2040.SP = 0x20004000;
    rp2040.PC = 0x10004000;
    rp2040.writeUint16(0x10004000, opcodeSVC(10));
    rp2040.registers[r0] = 0x44;
    rp2040.writeUint32(VTOR, 0x10040000);
    rp2040.writeUint32(0x10040000 + EXC_SVCALL * 4, SVCALL_HANDLER);
    rp2040.writeUint16(SVCALL_HANDLER, opcodeMOVS(r0, 0x55));

    rp2040.executeInstruction();
    expect(rp2040.pendingSVCall).toEqual(true);

    rp2040.executeInstruction(); // SVCall handler should run here
    expect(rp2040.pendingSVCall).toEqual(false);
    expect(rp2040.PC).toEqual(SVCALL_HANDLER + 2);
    expect(rp2040.registers[r0]).toEqual(0x55);
  });

  it('should execute a `sxtb r2, r2` instruction with sign bit 1', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeSXTB(r2, r2);
    rp2040.registers[r2] = 0x22446688;
    rp2040.executeInstruction();
    expect(rp2040.registers[r2]).toEqual(0xffffff88);
  });

  it('should execute a `sxtb r2, r2` instruction with sign bit 0', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeSXTB(r2, r2);
    rp2040.registers[r2] = 0x12345678;
    rp2040.executeInstruction();
    expect(rp2040.registers[r2]).toEqual(0x78);
  });

  it('should execute a `sxth r2, r5` instruction with sign bit 1', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeSXTH(r2, r5);
    rp2040.registers[r5] = 0x22448765;
    rp2040.executeInstruction();
    expect(rp2040.registers[r2]).toEqual(0xffff8765);
  });

  it('should execute an `tst r1, r3` instruction when the result is negative', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0x4219; // tst r1, r3
    rp2040.registers[r1] = 0xf0000000;
    rp2040.registers[r3] = 0xf0004000;
    rp2040.sram[24] = 0x55;
    rp2040.executeInstruction();
    expect(rp2040.N).toEqual(true);
  });

  it('should execute an `tst r1, r3` instruction when the registers are equal', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = 0x4219; // tst r1, r3
    rp2040.registers[r1] = 0;
    rp2040.registers[r3] = 55;
    rp2040.sram[24] = 0x55;
    rp2040.executeInstruction();
    expect(rp2040.Z).toEqual(true);
  });

  it('should execute an `uxtb r5, r3` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeUXTB(r5, r3);
    rp2040.registers[r3] = 0x12345678;
    rp2040.executeInstruction();
    expect(rp2040.registers[r5]).toEqual(0x78);
  });

  it('should execute an `uxth r3, r1` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeUXTH(r3, r1);
    rp2040.registers[r1] = 0x12345678;
    rp2040.executeInstruction();
    expect(rp2040.registers[r3]).toEqual(0x5678);
  });

  it('should execute a `wfi` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeWFI();
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000002);
  });

  it('should execute a `yield` instruction', () => {
    const rp2040 = new RP2040();
    rp2040.PC = 0x10000000;
    rp2040.flash16[0] = opcodeYIELD();
    rp2040.executeInstruction();
    expect(rp2040.PC).toEqual(0x10000002);
  });
});
