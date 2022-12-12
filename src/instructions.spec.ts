import { createTestDriver } from '../test-utils/create-test-driver';
import { ICortexTestDriver } from '../test-utils/test-driver';
import { RP2040TestDriver } from '../test-utils/test-driver-rp2040';
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
  opcodeBT1,
  opcodeBT2,
  opcodeBX,
  opcodeCMN,
  opcodeCMPimm,
  opcodeCMPregT1,
  opcodeCMPregT2,
  opcodeDMBSY,
  opcodeDSBSY,
  opcodeEORS,
  opcodeISBSY,
  opcodeLDMIA,
  opcodeLDRB,
  opcodeLDRBreg,
  opcodeLDRH,
  opcodeLDRHreg,
  opcodeLDRimm,
  opcodeLDRlit,
  opcodeLDRreg,
  opcodeLDRSB,
  opcodeLDRSH,
  opcodeLDRsp,
  opcodeLSLSimm,
  opcodeLSLSreg,
  opcodeLSRS,
  opcodeLSRSreg,
  opcodeMOV,
  opcodeMOVS,
  opcodeMOVSreg,
  opcodeMRS,
  opcodeMSR,
  opcodeMULS,
  opcodeMVNS,
  opcodeNOP,
  opcodeORRS,
  opcodePOP,
  opcodePUSH,
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
  opcodeTST,
  opcodeUDF,
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
const r11 = 11;
const r12 = 12;
const ip = 12;
const sp = 13;
const lr = 14;
const pc = 15;

const VTOR = 0xe000ed08;
const EXC_SVCALL = 11;

describe('Cortex-M0+ Instruction Set', () => {
  let cpu: ICortexTestDriver;

  beforeEach(async () => {
    cpu = await createTestDriver();
  });

  afterEach(async () => {
    await cpu.tearDown();
  });

  it('should execute `adcs r5, r4` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADCS(r5, r4));
    await cpu.setRegisters({ r4: 55, r5: 66, C: true });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(122);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(false);
  });

  it('should execute `adcs r5, r4` instruction and set negative/overflow flags', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADCS(r5, r4));
    await cpu.setRegisters({
      r4: 0x7fffffff, // Max signed INT32
      r5: 0,
      C: true,
    });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(0x80000000);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(true);
  });

  it('should not set the overflow flag when executing `adcs r3, r2` adding 0 to 0 with carry', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADCS(r3, r2));
    await cpu.setRegisters({ r2: 0, r3: 0, C: true, Z: true });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(1);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(false);
  });

  it('should set the zero, carry and overflow flag when executing `adcs r0, r0` adding 0x80000000 to 0x80000000', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADCS(r0, r0));
    await cpu.setRegisters({ r0: 0x80000000, C: false });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r0).toEqual(0);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(true);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(true);
  });

  it('should execute a `add sp, 0x10` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.setRegisters({ sp: 0x10000040 });
    await cpu.writeUint16(0x20000000, opcodeADDsp2(0x10));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.sp).toEqual(0x10000050);
  });

  it('should execute a `add r1, sp, #4` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.setRegisters({ sp: 0x54 });
    await cpu.writeUint16(0x20000000, opcodeADDspPlusImm(r1, 0x10));
    await cpu.setRegisters({ r1: 0 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.sp).toEqual(0x54);
    expect(registers.r1).toEqual(0x64);
  });

  it('should execute `adds r1, r2, #3` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADDS1(r1, r2, 3));
    await cpu.setRegisters({ r2: 2 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r1).toEqual(5);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(false);
  });

  it('should execute `adds r1, #1` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADDS2(r1, 1));
    await cpu.setRegisters({ r1: 0xffffffff });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r1).toEqual(0);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(true);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(false);
  });

  it('should execute `adds r1, r2, r7` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADDSreg(r1, r2, r7));
    await cpu.setRegisters({ r2: 2 });
    await cpu.setRegisters({ r7: 27 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r1).toEqual(29);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(false);
  });

  it('should execute `adds r4, r4, r2` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADDSreg(r4, r4, r2));
    await cpu.setRegisters({ r2: 0x74bc8000, r4: 0x43740000 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r4).toEqual(0xb8308000);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(true);
  });

  it('should execute `adds r1, r1, r1` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADDSreg(r1, r1, r1));
    await cpu.setRegisters({ r1: 0xbf8d1424, C: true });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r1).toEqual(0x7f1a2848);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(true);
  });

  it('should execute `add r1, ip` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADDreg(r1, ip));
    await cpu.setRegisters({ r1: 66, r12: 44 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r1).toEqual(110);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(false);
  });

  it('should not update the flags following `add r3, r12` instruction (encoding T2)', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADDreg(r3, r12));
    await cpu.setRegisters({ r3: 0x00002000, r12: 0xffffe000 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(false);
  });

  it('should execute `add sp, r8` instruction and not update the flags', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADDreg(sp, r8));
    await cpu.setRegisters({ sp: 0x20030000, Z: true, r8: 0x13 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.sp).toEqual(0x20030010);
    expect(registers.Z).toEqual(true); // assert it didn't update the flags
  });

  it('should execute `add pc, r8` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADDreg(pc, r8));
    await cpu.setRegisters({ r8: 0x11 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x20000014);
  });

  it('should execute `adr r4, #0x50` instruction and set the overflow flag correctly', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeADR(r4, 0x50));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r4).toEqual(0x20000054);
  });

  it('should execute `ands r5, r0` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeANDS(r5, r0));
    await cpu.setRegisters({ r5: 0xffff0000 });
    await cpu.setRegisters({ r0: 0xf00fffff });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(0xf00f0000);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
  });

  it('should execute an `asrs r3, r2, #31` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeASRS(r3, r2, 31));
    await cpu.setRegisters({ r2: 0x80000000, C: true });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0xffffffff);
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
  });

  it('should execute an `asrs r3, r2, #0` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeASRS(r3, r2, 0));
    await cpu.setRegisters({ r2: 0x80000000, C: true });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0xffffffff);
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
  });

  it('should execute an `asrs r3, r4` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeASRSreg(r3, r4));
    await cpu.setRegisters({ r3: 0x80000040 });
    await cpu.setRegisters({ r4: 0xff500007 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0xff000000);
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
  });

  it('should execute an `asrs r3, r4` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeASRSreg(r3, r4));
    await cpu.setRegisters({ r3: 0x40000040, r4: 50, C: true });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0);
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(true);
    expect(registers.C).toEqual(false);
  });

  it('should execute an `asrs r3, r4` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeASRSreg(r3, r4));
    await cpu.setRegisters({ r3: 0x40000040, r4: 31, C: true });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0);
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(true);
    expect(registers.C).toEqual(true);
  });

  it('should execute an `asrs r3, r4` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeASRSreg(r3, r4));
    await cpu.setRegisters({ r3: 0x80000040, r4: 50, C: true });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0xffffffff);
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
  });

  it('should execute an `asrs r3, r4` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeASRSreg(r3, r4));
    await cpu.setRegisters({ r3: 0x80000040, r4: 0, C: true });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0x80000040);
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
  });

  it('should execute `bics r0, r3` correctly', async () => {
    await cpu.setPC(0x20000000);
    await cpu.setRegisters({ r0: 0xff });
    await cpu.setRegisters({ r3: 0x0f });
    await cpu.writeUint16(0x20000000, opcodeBICS(r0, r3));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r0).toEqual(0xf0);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
  });

  it('should execute `bics r0, r3` instruction and set the negative flag correctly', async () => {
    await cpu.setPC(0x20000000);
    await cpu.setRegisters({ r0: 0xffffffff });
    await cpu.setRegisters({ r3: 0x0000ffff });
    await cpu.writeUint16(0x20000000, opcodeBICS(r0, r3));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r0).toEqual(0xffff0000);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
  });

  it('should execute `bl 0x34` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint32(0x20000000, opcodeBL(0x34));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x20000038);
    expect(registers.lr).toEqual(0x20000005);
  });

  it('should execute `bl -0x10` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint32(0x20000000, opcodeBL(-0x10));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x20000004 - 0x10);
    expect(registers.lr).toEqual(0x20000005);
  });

  it('should execute `bl -3242` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint32(0x20000000, opcodeBL(-3242));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x20000004 - 3242);
    expect(registers.lr).toEqual(0x20000005);
  });

  it('should execute `blx r3` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.setRegisters({ r3: 0x20000201 });
    await cpu.writeUint32(0x20000000, opcodeBLX(r3));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x20000200);
    expect(registers.lr).toEqual(0x20000003);
  });

  it('should execute a `b.n .-20` instruction', async () => {
    await cpu.setPC(0x20000000 + 9 * 2);
    await cpu.writeUint16(0x20000000 + 9 * 2, opcodeBT2(0xfec));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x20000002);
  });

  it('should execute a `bne.n .-6` instruction', async () => {
    await cpu.setPC(0x20000000 + 9 * 2);
    await cpu.setRegisters({ Z: false });
    await cpu.writeUint16(0x20000000 + 9 * 2, opcodeBT1(1, 0x1f8));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x2000000e);
  });

  it('should execute `bx lr` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.setRegisters({ lr: 0x10000200 });
    await cpu.writeUint32(0x20000000, opcodeBX(lr));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x10000200);
  });

  it('should execute an `cmn r5, r2` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeCMN(r7, r2));
    await cpu.setRegisters({ r2: 1 });
    await cpu.setRegisters({ r7: -2 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r2).toEqual(1);
    expect(registers.r7).toEqual(-2 >>> 0);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(false);
  });

  it('should execute an `cmp r5, #66` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeCMPimm(r5, 66));
    await cpu.setRegisters({ r5: 60 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(false);
  });

  it('should correctly set carry flag when executing `cmp r0, #0`', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeCMPimm(r0, 0));
    await cpu.setRegisters({ r0: 0x80010133 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(false);
  });

  it('should execute an `cmp r5, r0` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeCMPregT1(r5, r0));
    await cpu.setRegisters({ r5: 60 });
    await cpu.setRegisters({ r0: 56 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(false);
  });

  it('should execute an `cmp r2, r0` instruction and not set any flags when r0=0xb71b0000 and r2=0x00b71b00', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeCMPregT1(r2, r0));
    await cpu.setRegisters({ r0: 0xb71b0000, r2: 0x00b71b00 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(false);
  });

  it('should correctly set carry flag when executing `cmp r11, r3` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeCMPregT2(r11, r3));
    await cpu.setRegisters({ r3: 0x00000008, r11: 0xffffffff });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(false);
  });

  it('should execute an `cmp ip, r6` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeCMPregT2(ip, r6));
    await cpu.setRegisters({ r6: 56, r12: 60 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(false);
  });

  it('should set flags N C when executing `cmp r11, r3` instruction when r3=0 and r11=0x80000000', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeCMPregT2(r11, r3));
    await cpu.setRegisters({ r3: 0, r11: 0x80000000 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(false);
  });

  it('should set flags N V when executing `cmp r3, r7` instruction when r3=0 and r7=0x80000000', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeCMPregT1(r3, r7));
    await cpu.setRegisters({ r3: 0, r7: 0x80000000 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(true);
  });

  it('should set flags N V when executing `cmp r11, r3` instruction when r3=0x80000000 and r11=0', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeCMPregT2(r11, r3));
    await cpu.setRegisters({ r3: 0x80000000, r11: 0 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(true);
  });

  it('should set flags N C when executing `cmp r3, r7` instruction when r3=0x80000000 and r7=0', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeCMPregT1(r3, r7));
    await cpu.setRegisters({ r3: 0x80000000, r7: 0 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(false);
  });

  it('should correctly decode a `dmb sy` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint32(0x20000000, opcodeDMBSY());
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toBe(0x20000004);
  });

  it('should correctly decode a `dsb sy` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint32(0x20000000, opcodeDSBSY());
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toBe(0x20000004);
  });

  it('should execute an `eors r1, r3` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeEORS(r1, r3));
    await cpu.setRegisters({ r1: 0xf0f0f0f0 });
    await cpu.setRegisters({ r3: 0x08ff3007 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r1).toEqual(0xf80fc0f7);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
  });

  it('should correctly decode a `isb sy` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint32(0x20000000, opcodeISBSY());
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toBe(0x20000004);
  });

  it('should execute a `mov r3, r8` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeMOV(r3, r8));
    await cpu.setRegisters({ r8: 55 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(55);
  });

  it('should execute a `mov r3, pc` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeMOV(r3, pc));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0x20000004);
  });

  it('should execute a `mov sp, r8` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeMOV(r3, r8));
    await cpu.setRegisters({ r8: 55 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(55);
  });

  it('should execute a `muls r0, r2` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeMULS(r0, r2));
    await cpu.setRegisters({ r0: 5 });
    await cpu.setRegisters({ r2: 1000000 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r2).toEqual(5000000);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
  });

  it('should execute a muls instruction with large 32-bit numbers and produce the correct result', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeMULS(r0, r2));
    await cpu.setRegisters({ r0: 2654435769 });
    await cpu.setRegisters({ r2: 340573321 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r2).toEqual(1);
  });

  it('should execute a `muls r0, r2` instruction and set the Z flag when the result is zero', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeMULS(r0, r2));
    await cpu.setRegisters({ r0: 0 });
    await cpu.setRegisters({ r2: 1000000 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r2).toEqual(0);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(true);
  });

  it('should execute a `muls r0, r2` instruction and set the N flag when the result is negative', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeMULS(r0, r2));
    await cpu.setRegisters({ r0: -1 });
    await cpu.setRegisters({ r2: 1000000 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r2).toEqual(-1000000 >>> 0);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
  });

  it('should execute a `mvns r4, r3` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeMVNS(r4, r3));
    await cpu.setRegisters({ r3: 0x11115555 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r4).toEqual(0xeeeeaaaa);
    expect(registers.Z).toBe(false);
    expect(registers.N).toBe(true);
  });

  it('should execute a `nop` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeNOP());
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x20000002);
  });

  it('should execute `orrs r5, r0` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeORRS(r5, r0));
    await cpu.setRegisters({ r5: 0xf00f0000 });
    await cpu.setRegisters({ r0: 0xf000ffff });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(0xf00fffff);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
  });

  it('should execute a `pop pc, {r4, r5, r6}` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.setRegisters({ sp: RAM_START_ADDRESS + 0xf0 });
    await cpu.writeUint16(0x20000000, opcodePOP(true, (1 << r4) | (1 << r5) | (1 << r6)));
    await cpu.writeUint32(0x200000f0, 0x40);
    await cpu.writeUint32(0x200000f4, 0x50);
    await cpu.writeUint32(0x200000f8, 0x60);
    await cpu.writeUint32(0x200000fc, 0x42);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.sp).toEqual(RAM_START_ADDRESS + 0x100);
    // assert that the values of r4, r5, r6, pc were poped from the stack correctly
    expect(registers.r4).toEqual(0x40);
    expect(registers.r5).toEqual(0x50);
    expect(registers.r6).toEqual(0x60);
    expect(registers.pc).toEqual(0x42);
  });

  it('should execute a `push {r4, r5, r6, lr}` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.setRegisters({ sp: RAM_START_ADDRESS + 0x100 });
    await cpu.writeUint16(0x20000000, opcodePUSH(true, (1 << r4) | (1 << r5) | (1 << r6)));
    await cpu.setRegisters({ r4: 0x40, r5: 0x50, r6: 0x60, lr: 0x42 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    // assert that the values of r4, r5, r6, lr were pushed into the stack
    expect(registers.sp).toEqual(RAM_START_ADDRESS + 0xf0);
    expect(await cpu.readUint8(0x200000f0)).toEqual(0x40);
    expect(await cpu.readUint8(0x200000f4)).toEqual(0x50);
    expect(await cpu.readUint8(0x200000f8)).toEqual(0x60);
    expect(await cpu.readUint8(0x200000fc)).toEqual(0x42);
  });

  it('should execute a `mrs r0, ipsr` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint32(0x20000000, opcodeMRS(r0, 5)); // 5 == ipsr
    await cpu.setRegisters({ r0: 55 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r0).toEqual(0);
    expect(registers.pc).toEqual(0x20000004);
  });

  it('should execute a `msr msp, r0` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint32(0x20000000, opcodeMSR(8, r0)); // 8 == msp
    await cpu.setRegisters({ r0: 0x1234 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.sp).toEqual(0x1234);
    expect(registers.pc).toEqual(0x20000004);
  });

  it('should execute a `movs r5, #128` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeMOVS(r5, 128));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(128);
    expect(registers.pc).toEqual(0x20000002);
  });

  it('should execute a `ldmia r0!, {r1, r2}` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLDMIA(r0, (1 << r1) | (1 << r2)));
    await cpu.setRegisters({ r0: 0x20000010 });
    await cpu.writeUint32(0x20000010, 0xf00df00d);
    await cpu.writeUint32(0x20000014, 0x4242);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.r0).toEqual(0x20000018);
    expect(registers.r1).toEqual(0xf00df00d);
    expect(registers.r2).toEqual(0x4242);
  });

  it('should execute a `ldmia r5!, {r5}` instruction without writing back the address to r5', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLDMIA(r5, 1 << r5));
    await cpu.setRegisters({ r5: 0x20000010 });
    await cpu.writeUint32(0x20000010, 0xf00df00d);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.r5).toEqual(0xf00df00d);
  });

  it('should execute an `ldr r0, [pc, #148]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLDRlit(r0, 148));
    await cpu.writeUint32(0x20000000 + 152, 0x42);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r0).toEqual(0x42);
    expect(registers.pc).toEqual(0x20000002);
  });

  it('should execute an `ldr r3, [r2, #24]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLDRimm(r3, r2, 24));
    await cpu.setRegisters({ r2: 0x20000000 });
    await cpu.writeUint32(0x20000000 + 24, 0x55);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0x55);
  });

  it('should execute an `ldr r3, [sp, #12]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.setRegisters({ sp: 0x20000000 });
    await cpu.writeUint16(0x20000000, opcodeLDRsp(r3, 12));
    await cpu.writeUint32(0x20000000 + 12, 0x55);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0x55);
  });

  it('should execute an `ldr r3, [r5, r6]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLDRreg(r3, r5, r6));
    await cpu.setRegisters({ r5: 0x20000000 });
    await cpu.setRegisters({ r6: 0x8 });
    await cpu.writeUint32(0x20000008, 0xff554211);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0xff554211);
  });

  it('should execute an `ldrb r4, [r2, 5]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLDRB(r4, r2, 5));
    await cpu.setRegisters({ r2: 0x20000000 });
    await cpu.writeUint16(0x20000005, 0x7766);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r4).toEqual(0x66);
  });

  it('should execute an `ldrb r3, [r5, r6]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLDRBreg(r3, r5, r6));
    await cpu.setRegisters({ r5: 0x20000000 });
    await cpu.setRegisters({ r6: 0x8 });
    await cpu.writeUint32(0x20000008, 0xff554211);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0x11);
  });

  it('should execute an `ldrh r3, [r7, #4]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLDRH(r3, r7, 4));
    await cpu.setRegisters({ r7: 0x20000000 });
    await cpu.writeUint32(0x20000004, 0xffff7766);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0x7766);
  });

  it('should execute an `ldrh r3, [r7, #6]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLDRH(r3, r7, 6));
    await cpu.setRegisters({ r7: 0x20000000 });
    await cpu.writeUint32(0x20000004, 0x33447766);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0x3344);
  });

  it('should execute an `ldrh r3, [r5, r6]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLDRHreg(r3, r5, r6));
    await cpu.setRegisters({ r5: 0x20000000, r6: 0x8 });
    await cpu.writeUint32(0x20000008, 0xff554211);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0x4211);
  });

  it('should execute an `ldrsb r5, [r3, r5]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLDRSB(r5, r3, r5));
    await cpu.setRegisters({ r3: 0x20000000, r5: 6 });
    await cpu.writeUint32(0x20000006, 0x85);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(0xffffff85);
  });

  it('should execute an `ldrsh r5, [r3, r5]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLDRSH(r5, r3, r5));
    await cpu.setRegisters({ r3: 0x20000000 });
    await cpu.setRegisters({ r5: 6 });
    await cpu.writeUint16(0x20000006, 0xf055);
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(0xfffff055);
  });

  it('should execute a `udf 1` instruction', () => {
    const breakMock = jest.fn();
    const rp2040 = new RP2040();
    rp2040.core0.PC = 0x20000000;
    rp2040.writeUint16(0x20000000, opcodeUDF(0x1));
    rp2040.core0.onBreak = breakMock;
    rp2040.step();
    expect(rp2040.core0.PC).toEqual(0x20000002);
    expect(breakMock).toHaveBeenCalledWith(1);
  });

  it('should execute a `udf.w #0` (T2 encoding) instruction', () => {
    const breakMock = jest.fn();
    const rp2040 = new RP2040();
    rp2040.core0.PC = 0x20000000;
    rp2040.writeUint32(0x20000000, opcodeUDF2(0));
    rp2040.core0.onBreak = breakMock;
    rp2040.step();
    expect(rp2040.core0.PC).toEqual(0x20000004);
    expect(breakMock).toHaveBeenCalledWith(0);
  });

  it('should execute a `lsls r5, r5, #18` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLSLSimm(r5, r5, 18));
    await cpu.setRegisters({ r5: 0b00000000000000000011 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(0b11000000000000000000);
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.C).toEqual(false);
  });
  it('should execute a `lsls r5, r0` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLSLSreg(r5, r0));
    await cpu.setRegisters({ r5: 0b00000000000000000011 });
    await cpu.setRegisters({ r0: 0xff003302 }); // bottom byte: 02
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(0b00000000000000001100);
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.C).toEqual(false);
  });

  it('should execute a lsls r3, r4 instruction when shift >31', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLSLSreg(r3, r4));
    await cpu.setRegisters({ r3: 1, r4: 0x20, C: false });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0);
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.N).toEqual(false);
    expect(registers.C).toEqual(true);
    expect(registers.Z).toEqual(true);
  });

  it('should execute a `lsls r5, r5, #18` instruction with carry', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLSLSimm(r5, r5, 18));
    await cpu.setRegisters({ r5: 0x00004001 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(0x40000);
    expect(registers.C).toEqual(true);
  });

  it('should execute a `lsrs r5, r0` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLSRSreg(r5, r0));
    await cpu.setRegisters({ r5: 0xff00000f });
    await cpu.setRegisters({ r0: 0xff003302 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(0x3fc00003);
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.C).toEqual(true);
  });

  it('should return zero for `lsrs r2, r3` with 32 bit shift', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLSRSreg(r2, r3));
    await cpu.setRegisters({ r2: 10, r3: 32 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r2).toEqual(0);
    expect(registers.Z).toEqual(true);
    expect(registers.C).toEqual(false);
  });

  it('should execute a `lsrs r1, r1, #1` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLSRS(r1, r1, 1));
    await cpu.setRegisters({ r1: 0b10 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r1).toEqual(0b1);
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.C).toEqual(false);
  });

  it('should execute a `lsrs r1, r1, 0` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeLSRS(r1, r1, 0));
    await cpu.setRegisters({ r1: 0xffffffff });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r1).toEqual(0);
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.C).toEqual(true);
  });

  it('should keep lower 2 bits of sp clear when executing a `movs sp, r5` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeMOV(sp, r5));
    await cpu.setRegisters({ r5: 0x53 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.sp).toEqual(0x50);
  });

  it('should keep lower bit of pc clear when executing a `movs pc, r5` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeMOV(pc, r5));
    await cpu.setRegisters({ r5: 0x53 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x52);
  });

  it('should execute a `movs r6, r5` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeMOVSreg(r6, r5));
    await cpu.setRegisters({ r5: 0x50 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r6).toEqual(0x50);
  });

  it('should execute a `rsbs r0, r3` instruction', async () => {
    // This instruction is also calledasync  `negs`
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeRSBS(r0, r3));
    await cpu.setRegisters({ r3: 100 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r0 | 0).toEqual(-100);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(false);
  });

  it('should execute a `rev r3, r1` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeREV(r2, r3));
    await cpu.setRegisters({ r3: 0x11223344 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r2).toEqual(0x44332211);
  });

  it('should execute a `rev16 r0, r5` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeREV16(r0, r5));
    await cpu.setRegisters({ r5: 0x11223344 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r0).toEqual(0x22114433);
  });

  it('should execute a `revsh r1, r2` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeREVSH(r1, r2));
    await cpu.setRegisters({ r2: 0xeeaa55f0 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r1).toEqual(0xfffff055);
  });

  it('should execute a `ror r5, r3` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeROR(r5, r3));
    await cpu.setRegisters({ r5: 0x12345678 });
    await cpu.setRegisters({ r3: 0x2004 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0x2004);
    expect(registers.r5).toEqual(0x81234567);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
  });

  it('should execute a `ror r5, r3` instruction when r3 > 32', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeROR(r5, r3));
    await cpu.setRegisters({ r5: 0x12345678 });
    await cpu.setRegisters({ r3: 0x2044 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0x2044);
    expect(registers.r5).toEqual(0x81234567);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
  });

  it('should execute a `rsbs r0, r3` instruction', async () => {
    // This instruction is also calledasync  `negs`
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeRSBS(r0, r3));
    await cpu.setRegisters({ r3: 0 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r0 | 0).toEqual(0);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(true);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(false);
  });

  it('should execute a `sbcs r0, r3` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSBCS(r0, r3));
    await cpu.setRegisters({ r0: 100, r3: 55, C: false });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r0).toEqual(44);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(false);
  });

  it('should execute a `sbcs r0, r3` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSBCS(r0, r3));
    await cpu.setRegisters({ r0: 0, r3: 0xffffffff, C: false });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r0).toEqual(0);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(true);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(false);
  });

  it('should execute a `sdmia r0!, {r1, r2}` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSTMIA(r0, (1 << r1) | (1 << r2)));
    await cpu.setRegisters({ r0: 0x20000010, r1: 0xf00df00d, r2: 0x4242 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x20000002);
    expect(registers.r0).toEqual(0x20000018);
    expect(await cpu.readUint32(0x20000010)).toEqual(0xf00df00d);
    expect(await cpu.readUint32(0x20000014)).toEqual(0x4242);
  });

  it('should execute a `str r6, [r4, #20]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSTR(r6, r4, 20));
    await cpu.setRegisters({ r4: RAM_START_ADDRESS + 0x20, r6: 0xf00d });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(await cpu.readUint32(0x20000020 + 20)).toEqual(0xf00d);
    expect(registers.pc).toEqual(0x20000002);
  });

  it('should execute a `str r6, [r4, r5]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSTRreg(r6, r4, r5));
    await cpu.setRegisters({ r4: RAM_START_ADDRESS + 0x20 });
    await cpu.setRegisters({ r5: 20 });
    await cpu.setRegisters({ r6: 0xf00d });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(await cpu.readUint32(0x20000020 + 20)).toEqual(0xf00d);
    expect(registers.pc).toEqual(0x20000002);
  });

  it('should execute an `str r3, [sp, #12]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSTRsp(r3, 12));
    await cpu.setRegisters({ r3: 0xaa55, sp: 0x20000000 });
    await cpu.singleStep();
    expect(await cpu.readUint8(0x20000000 + 12)).toEqual(0x55);
    expect(await cpu.readUint8(0x20000000 + 13)).toEqual(0xaa);
  });

  it('should execute a `str r2, [r3, r1]` instruction where r1 + r3 > 32 bits', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSTRreg(r2, r1, r3));
    await cpu.setRegisters({ r1: -4, r3: 0x20041e50, r2: 0x4201337 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(await cpu.readUint32(0x20041e4c)).toEqual(0x4201337);
    expect(registers.pc).toEqual(0x20000002);
  });

  it('should execute a `strb r6, [r4, #20]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSTRB(r6, r4, 0x1));
    await cpu.writeUint32(0x20000020, 0xf5f4f3f2);
    await cpu.setRegisters({ r4: RAM_START_ADDRESS + 0x20, r6: 0xf055 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    // assert that the 2nd byte (at 0x21) changed to 0x55
    expect(await cpu.readUint32(0x20000020)).toEqual(0xf5f455f2);
    expect(registers.pc).toEqual(0x20000002);
  });

  it('should execute a `strb r6, [r4, r5]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSTRBreg(r6, r4, r5));
    await cpu.writeUint32(0x20000020, 0xf5f4f3f2);
    await cpu.setRegisters({ r4: RAM_START_ADDRESS + 0x20 });
    await cpu.setRegisters({ r5: 1 });
    await cpu.setRegisters({ r6: 0xf055 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    // assert that the 2nd byte (at 0x21) changed to 0x55
    expect(await cpu.readUint32(0x20000020)).toEqual(0xf5f455f2);
    expect(registers.pc).toEqual(0x20000002);
  });

  it('should execute a `strh r6, [r4, #20]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSTRH(r6, r4, 0x2));
    await cpu.writeUint32(0x20000020, 0xf5f4f3f2);
    await cpu.setRegisters({ r4: RAM_START_ADDRESS + 0x20 });
    await cpu.setRegisters({ r6: 0x6655 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    // assert that the 3rd/4th byte (at 0x22) changed to 0x6655
    expect(await cpu.readUint32(0x20000020)).toEqual(0x6655f3f2);
    expect(registers.pc).toEqual(0x20000002);
  });

  it('should execute a `strh r6, [r4, r1]` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSTRHreg(r6, r4, r1));
    await cpu.writeUint32(0x20000020, 0xf5f4f3f2);
    await cpu.setRegisters({ r4: RAM_START_ADDRESS + 0x20 });
    await cpu.setRegisters({ r1: 2 });
    await cpu.setRegisters({ r6: 0x6655 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    // assert that the 3rd/4th byte (at 0x22) changed to 0x6655
    expect(await cpu.readUint32(0x20000020)).toEqual(0x6655f3f2);
    expect(registers.pc).toEqual(0x20000002);
  });

  it('should execute a `sub sp, 0x10` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.setRegisters({ sp: 0x10000040 });
    await cpu.writeUint16(0x20000000, opcodeSUBsp(0x10));
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.sp).toEqual(0x10000030);
  });

  it('should execute a `subs r1, #1` instruction with overflow', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSUBS2(r1, 1));
    await cpu.setRegisters({ r1: -0x80000000 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r1).toEqual(0x7fffffff);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(true);
  });

  it('should execute a `subs r5, r3, 5` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSUBS1(r5, r3, 5));
    await cpu.setRegisters({ r3: 0 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5 | 0).toEqual(-5);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(false);
  });

  it('should execute a `subs r5, r3, r2` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSUBSreg(r5, r3, r2));
    await cpu.setRegisters({ r3: 6 });
    await cpu.setRegisters({ r2: 5 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(1);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(false);
  });

  it('should execute a `subs r3, r3, r2` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSUBSreg(r3, r3, r2));
    await cpu.setRegisters({ r2: 8, r3: 0xffffffff });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0xfffffff7);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(false);
  });

  it('should execute a `subs r5, r3, r2` instruction and set N V flags', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSUBSreg(r5, r3, r2));
    await cpu.setRegisters({ r3: 0 });
    await cpu.setRegisters({ r2: 0x80000000 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(0x80000000);
    expect(registers.N).toEqual(true);
    expect(registers.Z).toEqual(false);
    expect(registers.C).toEqual(false);
    expect(registers.V).toEqual(true);
  });

  it('should execute a `subs r5, r3, r2` instruction  and set Z C flags', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSUBSreg(r5, r3, r2));
    await cpu.setRegisters({ r2: 0x80000000 });
    await cpu.setRegisters({ r3: 0x80000000 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(0);
    expect(registers.N).toEqual(false);
    expect(registers.Z).toEqual(true);
    expect(registers.C).toEqual(true);
    expect(registers.V).toEqual(false);
  });

  it('should raise an SVCALL exception when `svc` instruction runs', async () => {
    const SVCALL_HANDLER = 0x20002000;
    await cpu.setRegisters({ sp: 0x20004000 });
    await cpu.setPC(0x20004000);
    await cpu.writeUint16(0x20004000, opcodeSVC(10));
    await cpu.setRegisters({ r0: 0x44 });
    await cpu.writeUint32(VTOR, 0x20040000);
    await cpu.writeUint32(0x20040000 + EXC_SVCALL * 4, SVCALL_HANDLER);
    await cpu.writeUint16(SVCALL_HANDLER, opcodeMOVS(r0, 0x55));

    await cpu.singleStep();
    if (cpu instanceof RP2040TestDriver) {
      expect(cpu.rp2040.core0.pendingSVCall).toEqual(true);
    }

    await cpu.singleStep(); // SVCall handler should run here
    const registers2 = await cpu.readRegisters();
    if (cpu instanceof RP2040TestDriver) {
      expect(cpu.rp2040.core0.pendingSVCall).toEqual(false);
    }
    expect(registers2.pc).toEqual(SVCALL_HANDLER + 2);
    expect(registers2.r0).toEqual(0x55);
  });

  it('should execute a `sxtb r2, r2` instruction with sign bit 1', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSXTB(r2, r2));
    await cpu.setRegisters({ r2: 0x22446688 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r2).toEqual(0xffffff88);
  });

  it('should execute a `sxtb r2, r2` instruction with sign bit 0', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSXTB(r2, r2));
    await cpu.setRegisters({ r2: 0x12345678 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r2).toEqual(0x78);
  });

  it('should execute a `sxth r2, r5` instruction with sign bit 1', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeSXTH(r2, r5));
    await cpu.setRegisters({ r5: 0x22448765 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r2).toEqual(0xffff8765);
  });

  it('should execute an `tst r1, r3` instruction when the result is negative', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeTST(r1, r3));
    await cpu.setRegisters({ r1: 0xf0000000 });
    await cpu.setRegisters({ r3: 0xf0004000 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.N).toEqual(true);
  });

  it('should execute an `tst r1, r3` instruction when the registers are different', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeTST(r1, r3));
    await cpu.setRegisters({ r1: 0xf0, r3: 0x0f });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.Z).toEqual(true);
  });

  it('should execute an `uxtb r5, r3` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeUXTB(r5, r3));
    await cpu.setRegisters({ r3: 0x12345678 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r5).toEqual(0x78);
  });

  it('should execute an `uxth r3, r1` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeUXTH(r3, r1));
    await cpu.setRegisters({ r1: 0x12345678 });
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.r3).toEqual(0x5678);
  });

  it('should execute a `wfi` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeWFI());
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x20000002);
  });

  it('should execute a `yield` instruction', async () => {
    await cpu.setPC(0x20000000);
    await cpu.writeUint16(0x20000000, opcodeYIELD());
    await cpu.singleStep();
    const registers = await cpu.readRegisters();
    expect(registers.pc).toEqual(0x20000002);
  });
});
