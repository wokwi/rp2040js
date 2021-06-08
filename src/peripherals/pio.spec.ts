import { createTestDriver } from '../../test-utils/create-test-driver';
import { ICortexTestDriver } from '../../test-utils/test-driver';
import {
  pioIN,
  pioIRQ,
  pioJMP,
  pioMOV,
  pioOUT,
  pioPULL,
  pioPUSH,
  pioSET,
  pioWAIT,
  PIO_COND_ALWAYS,
  PIO_COND_NOTEMPTYOSR,
  PIO_COND_NOTX,
  PIO_COND_NOTY,
  PIO_COND_XDEC,
  PIO_COND_XNEY,
  PIO_COND_YDEC,
  PIO_DEST_EXEC,
  PIO_DEST_NULL,
  PIO_DEST_PC,
  PIO_DEST_PINS,
  PIO_DEST_X,
  PIO_DEST_Y,
  PIO_MOV_DEST_OSR,
  PIO_MOV_DEST_PC,
  PIO_MOV_DEST_X,
  PIO_MOV_DEST_Y,
  PIO_OP_BITREV,
  PIO_OP_INVERT,
  PIO_OP_NONE,
  PIO_SRC_NULL,
  PIO_SRC_X,
  PIO_SRC_Y,
  PIO_WAIT_SRC_IRQ,
} from '../utils/pio-assembler';

const CTRL = 0x50200000;
const FLEVEL = 0x5020000c;
const TXF0 = 0x50200010;
const RXF0 = 0x50200020;
const IRQ = 0x50200030;
const INSTR_MEM0 = 0x50200048;
const INSTR_MEM1 = 0x5020004c;
const INSTR_MEM2 = 0x50200050;
const SM0_SHIFTCTRL = 0x502000d0;
const IN_SHIFTDIR = 18;
const OUT_SHIFTDIR = 19;
const SM0_ADDR = 0x502000d4;
const SM0_INSTR = 0x502000d8;
const SM0_PINCTRL = 0x502000dc;
const SM2_INSTR = 0x50200108;

// SHIFTs for FLEVEL
const TX0_SHIFT = 0;
const RX0_SHIFT = 4;

// SM0_SHIFTCTRL bits:
const FJOIN_RX = 1 << 30;

const DBG_PADOUT = 0x5020003c;

const SET_COUNT_SHIFT = 26;
const SET_COUNT_BASE = 5;
const OUT_COUNT_SHIFT = 20;

const VALID_PINS_MASK = 0x3fffffff;

// TODO:
//
// Instructions:
// - JMP PIN
// - SET PINDIRS
// - MOV EXEC
// - MOV ISR
// - some more
//
// Behaviors:
// - FIFO joinning (FJOIN_RX / FJOIN_TX)
// - Shift direction (OUT_SHIFTDIR / IN_SHIFTDIR)
// - Auto pull/push (PULL_THRESH / PUSH_THRESH / AUTOPULL / AUTOPUSH)
// - Sidepins (SIDE_EN / SIDE_PINDIR)
// - Inline OUT enable (OUT_EN_SEL / INLINE_OUT_EN)
// - Out sticky (OUT_STICKY)
// - Wrapping (WRAP_TOP/WRAP_BOTTOM)
// - STATUS (STATUS_SEL / STATUS_N)
// - Delay bits

describe('PIO', () => {
  let cpu: ICortexTestDriver;

  beforeEach(async () => {
    cpu = await createTestDriver();
  });

  afterEach(async () => {
    await cpu.tearDown();
  });

  async function resetStateMachines() {
    await cpu.writeUint32(CTRL, 0xf0);
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_ALWAYS, 0)); // Jump machine 0 to address 0
    // Clear FIFOs
    await cpu.writeUint32(SM0_SHIFTCTRL, FJOIN_RX);
    // Values at reset
    await cpu.writeUint32(SM0_SHIFTCTRL, (1 << IN_SHIFTDIR) | (1 << OUT_SHIFTDIR));
    await cpu.writeUint32(SM0_PINCTRL, 5 << SET_COUNT_SHIFT);
  }

  it('should execute a `SET PINS` instruction correctly', async () => {
    // SET PINS, 13
    // then check the debug register and verify that that output from the pins matches the PINS value
    const shiftAmount = 0;
    const pinsQty = 5;
    const pinsValue = 13;
    await resetStateMachines();
    await cpu.writeUint32(
      SM0_PINCTRL,
      (pinsQty << SET_COUNT_SHIFT) | (shiftAmount << SET_COUNT_BASE)
    );
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_PINS, pinsValue));
    expect((await cpu.readUint32(DBG_PADOUT)) & (((1 << pinsQty) - 1) << shiftAmount)).toBe(
      pinsValue << shiftAmount
    );
  });

  it('should execute a `MOV PINS, X` instruction correctly', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_PINCTRL, 32 << OUT_COUNT_SHIFT);
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 8));
    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_DEST_PINS, PIO_OP_NONE, PIO_SRC_X));
    expect(await cpu.readUint32(DBG_PADOUT)).toBe(8);
  });

  it('should execute a `MOV PINS, ~X` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_PINCTRL, 32 << OUT_COUNT_SHIFT);
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 29));
    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_DEST_PINS, PIO_OP_INVERT, PIO_SRC_X));
    expect(await cpu.readUint32(DBG_PADOUT)).toBe(~29 & VALID_PINS_MASK);
  });

  it('should correctly `MOV PINS, ::X` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_PINCTRL, 32 << OUT_COUNT_SHIFT);
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 0b11001));
    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_DEST_PINS, PIO_OP_BITREV, PIO_SRC_X));
    expect(await cpu.readUint32(DBG_PADOUT)).toBe(0x98000000 & VALID_PINS_MASK);
  });

  it('should correctly a `MOV Y, X` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_PINCTRL, 32 << OUT_COUNT_SHIFT);
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 11));
    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_MOV_DEST_Y, PIO_OP_NONE, PIO_SRC_X));
    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_DEST_PINS, PIO_OP_NONE, PIO_SRC_Y));
    expect(await cpu.readUint32(DBG_PADOUT)).toBe(11);
  });

  it('should correctly a `MOV PC, Y` instruction', async () => {
    await resetStateMachines();
    expect(await cpu.readUint32(SM0_ADDR)).toBe(0);
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_Y, 23));
    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_MOV_DEST_PC, PIO_OP_NONE, PIO_SRC_Y));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(23);
  });

  it('should correctly execute a `JMP` (always) instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_ALWAYS, 10));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(10);
  });

  it('should correctly execute a `JMP !X` instruction', async () => {
    await resetStateMachines();
    expect(await cpu.readUint32(SM0_ADDR)).toBe(0);
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 5));
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_NOTX, 8));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(0);
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 0));
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_NOTX, 8));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(8);
  });

  it('should correctly execute a `JMP X--` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_PINCTRL, 32 << OUT_COUNT_SHIFT);
    expect(await cpu.readUint32(SM0_ADDR)).toBe(0);
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 5));
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_XDEC, 12));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(12);
    // X should be 4:
    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_DEST_PINS, PIO_OP_NONE, PIO_SRC_X));
    expect(await cpu.readUint32(DBG_PADOUT)).toBe(4);
    // now set X to zero and ensure that we don't jump again
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 0));
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_XDEC, 6));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(12);
  });

  it('should correctly execute a `JMP !Y` instruction', async () => {
    await resetStateMachines();
    expect(await cpu.readUint32(SM0_ADDR)).toBe(0);
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_Y, 6));
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_NOTY, 8));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(0);
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_Y, 0));
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_NOTY, 8));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(8);
  });

  it('should correctly execute a `JMP Y--` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_PINCTRL, 32 << OUT_COUNT_SHIFT);
    expect(await cpu.readUint32(SM0_ADDR)).toBe(0);
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_Y, 15));
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_YDEC, 12));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(12);
    // Y should be 14:
    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_DEST_PINS, PIO_OP_NONE, PIO_SRC_Y));
    expect(await cpu.readUint32(DBG_PADOUT)).toBe(14);
    // now set X to zero and ensure that we don't jump again
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_Y, 0));
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_YDEC, 6));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(12);
  });

  it('should correctly execute a `JMP X!=Y` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_PINCTRL, 32 << OUT_COUNT_SHIFT);
    expect(await cpu.readUint32(SM0_ADDR)).toBe(0);
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 23));
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_Y, 23));
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_XNEY, 26));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(0);
    // Set X to a value different from Y:
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 3));
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_XNEY, 26));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(26);
  });

  it('should correctly execute a `JMP OSRE` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_PINCTRL, 32 << OUT_COUNT_SHIFT);
    expect(await cpu.readUint32(SM0_ADDR)).toBe(0);
    // The following command fills the OSR (Output Shift Register)
    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_MOV_DEST_OSR, PIO_OP_NONE, PIO_SRC_NULL));
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_NOTEMPTYOSR, 11));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(11);
    // Now empty the OSR by shifting bits out of it, and observe that the JMP isn't taken
    await cpu.writeUint32(SM0_INSTR, pioOUT(PIO_DEST_NULL, 32));
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_NOTEMPTYOSR, 22));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(11);
  });

  it('should correctly execute a program with `PULL` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_PINCTRL, 32 << OUT_COUNT_SHIFT);
    await cpu.writeUint32(TXF0, 0x42f00d43);
    expect(await cpu.readUint32(FLEVEL)).toEqual(1 << TX0_SHIFT); // TX0 should have 1 item
    await cpu.writeUint32(SM0_INSTR, pioPULL(false, false));
    expect(await cpu.readUint32(FLEVEL)).toEqual(0 << TX0_SHIFT); // TX0 should now have 0 items
    await cpu.writeUint32(SM0_INSTR, pioOUT(PIO_DEST_PINS, 32));
    expect(await cpu.readUint32(DBG_PADOUT)).toBe(0x42f00d43 & VALID_PINS_MASK);
  });

  it('should correctly execute the `OUT EXEC` instructions', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_PINCTRL, 32 << OUT_COUNT_SHIFT);
    await cpu.writeUint32(TXF0, pioJMP(PIO_COND_ALWAYS, 16));
    await cpu.writeUint32(SM0_INSTR, pioPULL(false, false));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(0);
    await cpu.writeUint32(SM0_INSTR, pioOUT(PIO_DEST_EXEC, 32));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(16);
  });

  it('should correctly execute the `OUT PC` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_PINCTRL, 32 << OUT_COUNT_SHIFT);
    await cpu.writeUint32(TXF0, 29);
    await cpu.writeUint32(SM0_INSTR, pioPULL(false, false));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(0);
    await cpu.writeUint32(SM0_INSTR, pioOUT(PIO_DEST_PC, 32));
    expect(await cpu.readUint32(SM0_ADDR)).toBe(29);
  });

  it('should correctly execute a program with a `PUSH` instruction', async () => {
    await resetStateMachines();
    expect(await cpu.readUint32(FLEVEL)).toEqual(0 << RX0_SHIFT); // RX0 should have 0 items
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 9));
    await cpu.writeUint32(SM0_INSTR, pioIN(PIO_SRC_X, 32));
    await cpu.writeUint32(SM0_INSTR, pioPUSH(false, false));
    expect(await cpu.readUint32(FLEVEL)).toEqual(1 << RX0_SHIFT); // RX0 should now have 1 item
    await cpu.writeUint32(SM0_INSTR, pioPUSH(false, false));
    expect(await cpu.readUint32(FLEVEL)).toEqual(2 << RX0_SHIFT); // RX0 should now have 2 item
    expect(await cpu.readUint32(RXF0)).toBe(9); // What we had in X
    expect(await cpu.readUint32(FLEVEL)).toEqual(1 << RX0_SHIFT); // RX0 should now have 1 item
    expect(await cpu.readUint32(RXF0)).toBe(0); // ISR should be zeroed after the first push
    expect(await cpu.readUint32(FLEVEL)).toEqual(0 << RX0_SHIFT); // RX0 should have 0 items
  });

  it('should correctly execute a program with an `IRQ 2` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(IRQ, 0xff);
    await cpu.writeUint32(SM0_INSTR, pioIRQ(false, false, 2));
    expect(await cpu.readUint32(IRQ)).toEqual(1 << 2);
    await cpu.writeUint32(SM0_INSTR, pioIRQ(true, false, 2));
    expect(await cpu.readUint32(IRQ)).toEqual(0);
  });

  it('should correctly execute a program with an `IRQ 3 rel` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(IRQ, 0xff);
    await cpu.writeUint32(SM2_INSTR, pioIRQ(false, false, 0x13));
    expect(await cpu.readUint32(IRQ)).toEqual(1 << 1);
    await cpu.writeUint32(SM2_INSTR, pioIRQ(true, false, 0x13));
    expect(await cpu.readUint32(IRQ)).toEqual(0);
    await cpu.writeUint32(SM0_INSTR, pioIRQ(false, false, 0x13));
    expect(await cpu.readUint32(IRQ)).toEqual(1 << 3);
  });

  it('should correctly execute a program with an `WAIT IRQ 7` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(IRQ, 0xff);
    await cpu.writeUint32(INSTR_MEM0, pioMOV(PIO_MOV_DEST_X, PIO_OP_NONE, PIO_SRC_X));
    await cpu.writeUint32(INSTR_MEM1, pioWAIT(true, PIO_WAIT_SRC_IRQ, 7));
    await cpu.writeUint32(INSTR_MEM2, pioJMP(PIO_COND_ALWAYS, 2));
    await cpu.writeUint32(CTRL, 1); // Starts State Machine #0
    expect(await cpu.readUint32(SM0_ADDR)).toEqual(1);
    await cpu.writeUint32(SM2_INSTR, pioIRQ(false, false, 5)); // Set IRQ 5
    expect(await cpu.readUint32(SM0_ADDR)).toEqual(1);
    await cpu.writeUint32(SM2_INSTR, pioIRQ(false, false, 7)); // Set IRQ 7
    expect(await cpu.readUint32(SM0_ADDR)).toEqual(2);
    expect(await cpu.readUint32(IRQ)).toEqual(1 << 5); // Wait should have cleared IRQ 7
  });

  it('should correctly execute a program with an `WAIT 0 IRQ 7` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(IRQ, 0xff);
    await cpu.writeUint32(SM0_INSTR, pioIRQ(false, false, 7)); // Set IRQ 7
    await cpu.writeUint32(INSTR_MEM0, pioMOV(PIO_MOV_DEST_X, PIO_OP_NONE, PIO_SRC_X));
    await cpu.writeUint32(INSTR_MEM1, pioWAIT(false, PIO_WAIT_SRC_IRQ, 7));
    await cpu.writeUint32(INSTR_MEM2, pioJMP(PIO_COND_ALWAYS, 2));
    await cpu.writeUint32(CTRL, 1); // Starts State Machine #0
    expect(await cpu.readUint32(SM0_ADDR)).toEqual(1);
    await cpu.writeUint32(IRQ, 1 << 7); // Clear IRQ 7
    expect(await cpu.readUint32(SM0_ADDR)).toEqual(2);
  });
});
