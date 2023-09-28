import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDriver } from '../../test-utils/create-test-driver';
import { ICortexTestDriver } from '../../test-utils/test-driver';
import {
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
  PIO_MOV_DEST_ISR,
  PIO_MOV_DEST_OSR,
  PIO_MOV_DEST_PC,
  PIO_MOV_DEST_X,
  PIO_MOV_DEST_Y,
  PIO_OP_BITREV,
  PIO_OP_INVERT,
  PIO_OP_NONE,
  PIO_SRC_NULL,
  PIO_SRC_STATUS,
  PIO_SRC_X,
  PIO_SRC_Y,
  PIO_WAIT_SRC_IRQ,
  pioIN,
  pioIRQ,
  pioJMP,
  pioMOV,
  pioOUT,
  pioPULL,
  pioPUSH,
  pioSET,
  pioWAIT,
} from '../utils/pio-assembler';

const CTRL = 0x50200000;
const FLEVEL = 0x5020000c;
const TXF0 = 0x50200010;
const RXF0 = 0x50200020;
const IRQ = 0x50200030;
const INSTR_MEM0 = 0x50200048;
const INSTR_MEM1 = 0x5020004c;
const INSTR_MEM2 = 0x50200050;
const INSTR_MEM3 = 0x50200054;
const SM0_SHIFTCTRL = 0x502000d0;
const SM0_EXECCTRL = 0x502000cc;
const SM0_ADDR = 0x502000d4;
const SM0_INSTR = 0x502000d8;
const SM0_PINCTRL = 0x502000dc;
const SM2_INSTR = 0x50200108;
const INTR = 0x50200128;
const IRQ0_INTE = 0x5020012c;

const NVIC_ISPR = 0xe000e200;
const NVIC_ICPR = 0xe000e280;

// Interrupt flags
const PIO_IRQ0 = 1 << 7;
const INTR_SM0_RXNEMPTY = 1 << 0;
const INTR_SM0_TXNFULL = 1 << 4;

// SHIFTs for FLEVEL
const TX0_SHIFT = 0;
const RX0_SHIFT = 4;

// SM0_SHIFTCTRL bits:
const FJOIN_RX = 1 << 30;
const IN_SHIFTDIR = 1 << 18;
const OUT_SHIFTDIR = 1 << 19;
const SHIFTCTRL_AUTOPULL = 1 << 17;
const SHIFTCTRL_AUTOPUSH = 1 << 16;
const SHIFTCTRL_PULL_THRESH_SHIFT = 25;
const SHIFTCTRL_PUSH_THRESH_SHIFT = 20;

// EXECCTRL bits:
const EXECCTRL_EXEC_STALLED = 1 << 31;
const EXECCTRL_STATUS_SEL = 1 << 4;
const EXECCTRL_WRAP_BOTTOM_SHIFT = 7;
const EXECCTRL_WRAP_TOP_SHIFT = 12;
const EXECCTRL_STATUS_N_SHIFT = 0;

const DBG_PADOUT = 0x5020003c;

const SET_COUNT_SHIFT = 26;
const SET_COUNT_BASE = 5;
const OUT_COUNT_SHIFT = 20;

const VALID_PINS_MASK = 0x3fffffff;

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
    await cpu.writeUint32(SM0_SHIFTCTRL, IN_SHIFTDIR | OUT_SHIFTDIR);
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

  it('should correctly a `MOV ISR, STATUS` instruction when the STATUS_SEL is 0 (TX FIFO)', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_EXECCTRL, 2 << EXECCTRL_STATUS_N_SHIFT);
    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_MOV_DEST_ISR, PIO_OP_NONE, PIO_SRC_STATUS));
    await cpu.writeUint32(SM0_INSTR, pioPUSH(false, false));
    expect(await cpu.readUint32(RXF0)).toBe(0xffffffff);

    await cpu.writeUint32(TXF0, 1);
    await cpu.writeUint32(TXF0, 2);
    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_MOV_DEST_ISR, PIO_OP_NONE, PIO_SRC_STATUS));
    await cpu.writeUint32(SM0_INSTR, pioPUSH(false, false));
    expect(await cpu.readUint32(RXF0)).toBe(0);
  });

  it('should correctly a `MOV ISR, STATUS` instruction when the STATUS_SEL is 1 (RX FIFO)', async () => {
    await resetStateMachines();
    await cpu.writeUint32(SM0_EXECCTRL, (1 << EXECCTRL_STATUS_N_SHIFT) | EXECCTRL_STATUS_SEL);

    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_MOV_DEST_ISR, PIO_OP_NONE, PIO_SRC_STATUS));
    await cpu.writeUint32(SM0_INSTR, pioPUSH(false, false));
    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_MOV_DEST_ISR, PIO_OP_NONE, PIO_SRC_STATUS));
    await cpu.writeUint32(SM0_INSTR, pioPUSH(false, false));
    expect(await cpu.readUint32(RXF0)).toBe(0xffffffff);
    expect(await cpu.readUint32(RXF0)).toBe(0);
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

  it('should update INTR after executing an `IRQ 2` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(IRQ, 0xff); // Clear all IRQs
    await cpu.writeUint32(SM2_INSTR, pioIRQ(false, false, 0x2));
    expect((await cpu.readUint32(INTR)) & 0xf00).toEqual(1 << 10);
  });

  it('should correctly compare X to 0xffffffff after executing a `mov x, ~null` instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(TXF0, 0xffffffff);
    await cpu.writeUint32(SM0_INSTR, pioPULL(false, false));
    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_DEST_X, PIO_OP_INVERT, PIO_SRC_NULL)); // X <- ~0 = 0xffffffff
    await cpu.writeUint32(SM0_INSTR, pioOUT(PIO_DEST_Y, 32)); // Y <- 0xffffffff
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_ALWAYS, 8));
    await cpu.writeUint32(SM0_INSTR, pioJMP(PIO_COND_XNEY, 16)); // Shouldn't take the jump
    expect(await cpu.readUint32(SM0_ADDR)).toEqual(8); // Assert that the 2nd jump wasn't taken
  });

  it('should wrap the program when it gets to EXECCTRL_WRAP_TOP', async () => {
    await resetStateMachines();
    await cpu.writeUint32(
      SM0_EXECCTRL,
      (1 << EXECCTRL_WRAP_BOTTOM_SHIFT) | (2 << EXECCTRL_WRAP_TOP_SHIFT)
    );

    // State machine Pseudo code:
    //   jmp .label2
    // .wrap_target
    // label1:
    //   jmp label1
    // label2:
    //   mov x, null
    // .wrap
    // label3:
    //   jmp label3

    await cpu.writeUint32(INSTR_MEM0, pioJMP(PIO_COND_ALWAYS, 2));
    await cpu.writeUint32(INSTR_MEM1, pioJMP(PIO_COND_ALWAYS, 1)); // infinite loop
    await cpu.writeUint32(INSTR_MEM2, pioMOV(PIO_DEST_X, PIO_OP_NONE, PIO_SRC_X));
    await cpu.writeUint32(INSTR_MEM3, pioJMP(PIO_COND_ALWAYS, 3)); // infinite loop

    await cpu.writeUint32(CTRL, 1); // Starts State Machine #0
    expect(await cpu.readUint32(SM0_ADDR)).toEqual(1);
  });

  it('should automatically pull when Autopull is enabled', async () => {
    await resetStateMachines();
    await cpu.writeUint32(
      SM0_SHIFTCTRL,
      SHIFTCTRL_AUTOPULL | (4 << SHIFTCTRL_PULL_THRESH_SHIFT) | OUT_SHIFTDIR
    );
    await cpu.writeUint32(TXF0, 0x5);
    await cpu.writeUint32(TXF0, 0x6);
    await cpu.writeUint32(TXF0, 0x7);

    await cpu.writeUint32(SM0_INSTR, pioOUT(PIO_DEST_X, 4)); // 5
    await cpu.writeUint32(SM0_INSTR, pioIN(PIO_SRC_X, 4));
    await cpu.writeUint32(SM0_INSTR, pioOUT(PIO_DEST_X, 4)); // 6
    await cpu.writeUint32(SM0_INSTR, pioIN(PIO_SRC_X, 4));
    await cpu.writeUint32(SM0_INSTR, pioOUT(PIO_DEST_X, 4)); // 7
    await cpu.writeUint32(SM0_INSTR, pioIN(PIO_SRC_X, 4));
    await cpu.writeUint32(SM0_INSTR, pioPUSH(false, false));

    expect(await cpu.readUint32(RXF0)).toEqual(0x567);
  });

  it('should not Autopull in the middle of OUT instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(
      SM0_SHIFTCTRL,
      SHIFTCTRL_AUTOPULL | (4 << SHIFTCTRL_PULL_THRESH_SHIFT) | OUT_SHIFTDIR
    );
    await cpu.writeUint32(TXF0, 0x25);
    await cpu.writeUint32(TXF0, 0x36);

    await cpu.writeUint32(SM0_INSTR, pioOUT(PIO_DEST_X, 8));
    await cpu.writeUint32(SM0_INSTR, pioIN(PIO_SRC_X, 8));
    await cpu.writeUint32(SM0_INSTR, pioPUSH(false, false));

    expect(await cpu.readUint32(RXF0)).toEqual(0x25);
  });

  it('should stall until the TX FIFO fills when executing an OUT instruction with Autopull', async () => {
    await resetStateMachines();
    await cpu.writeUint32(
      SM0_SHIFTCTRL,
      SHIFTCTRL_AUTOPULL | (4 << SHIFTCTRL_PULL_THRESH_SHIFT) | OUT_SHIFTDIR
    );

    await cpu.writeUint32(SM0_INSTR, pioOUT(PIO_DEST_X, 4));

    expect((await cpu.readUint32(SM0_EXECCTRL)) & EXECCTRL_EXEC_STALLED).toEqual(
      EXECCTRL_EXEC_STALLED
    );

    console.log('now writing to TXF0');
    await cpu.writeUint32(TXF0, 0x36); // Unstalls the machine
    expect((await cpu.readUint32(SM0_EXECCTRL)) & EXECCTRL_EXEC_STALLED).toEqual(0);
  });

  it('should automatically push when Autopush is enabled', async () => {
    await resetStateMachines();
    await cpu.writeUint32(
      SM0_SHIFTCTRL,
      SHIFTCTRL_AUTOPUSH | (8 << SHIFTCTRL_PUSH_THRESH_SHIFT) | OUT_SHIFTDIR
    );

    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 0x13));
    await cpu.writeUint32(SM0_INSTR, pioIN(PIO_SRC_X, 8));

    expect(await cpu.readUint32(RXF0)).toEqual(0x13);
  });

  it('should only Autopush at the end the the IN instruction', async () => {
    await resetStateMachines();
    await cpu.writeUint32(
      SM0_SHIFTCTRL,
      SHIFTCTRL_AUTOPUSH | (8 << SHIFTCTRL_PUSH_THRESH_SHIFT) | OUT_SHIFTDIR
    );

    await cpu.writeUint32(SM0_INSTR, pioMOV(PIO_DEST_X, PIO_OP_INVERT, PIO_SRC_NULL));
    await cpu.writeUint32(SM0_INSTR, pioIN(PIO_SRC_X, 16));

    expect(await cpu.readUint32(RXF0)).toEqual(0xffff);
  });

  it('should stall until the RX FIFO has capacity when executing an IN instruction with Autopush', async () => {
    await resetStateMachines();
    await cpu.writeUint32(
      SM0_SHIFTCTRL,
      SHIFTCTRL_AUTOPUSH | (8 << SHIFTCTRL_PUSH_THRESH_SHIFT) | OUT_SHIFTDIR
    );

    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 15));
    await cpu.writeUint32(SM0_INSTR, pioIN(PIO_SRC_X, 8));
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 16));
    await cpu.writeUint32(SM0_INSTR, pioIN(PIO_SRC_X, 8));
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 17));
    await cpu.writeUint32(SM0_INSTR, pioIN(PIO_SRC_X, 8));
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 18));
    await cpu.writeUint32(SM0_INSTR, pioIN(PIO_SRC_X, 8));
    await cpu.writeUint32(SM0_INSTR, pioSET(PIO_DEST_X, 19));
    await cpu.writeUint32(SM0_INSTR, pioIN(PIO_SRC_X, 8)); // Should fill the RX FIFO and stall!

    expect((await cpu.readUint32(SM0_EXECCTRL)) & EXECCTRL_EXEC_STALLED).toEqual(
      EXECCTRL_EXEC_STALLED
    );

    expect(await cpu.readUint16(RXF0)).toEqual(15); // Unstalls the machine
    expect((await cpu.readUint32(SM0_EXECCTRL)) & EXECCTRL_EXEC_STALLED).toEqual(0);
    expect(await cpu.readUint16(RXF0)).toEqual(16);
    expect(await cpu.readUint16(RXF0)).toEqual(17);
    expect(await cpu.readUint16(RXF0)).toEqual(18);
    expect(await cpu.readUint16(RXF0)).toEqual(19);
  });

  it('should update TXNFULL flag in INTR according to the level of the TX FIFO (issue #73)', async () => {
    await resetStateMachines();
    await cpu.writeUint32(IRQ0_INTE, INTR_SM0_TXNFULL);
    expect((await cpu.readUint32(INTR)) & INTR_SM0_TXNFULL).toEqual(INTR_SM0_TXNFULL);
    expect((await cpu.readUint32(NVIC_ISPR)) & PIO_IRQ0).toEqual(PIO_IRQ0);
    await cpu.writeUint32(TXF0, 1);
    await cpu.writeUint32(TXF0, 2);
    await cpu.writeUint32(TXF0, 3);
    await cpu.writeUint32(NVIC_ICPR, PIO_IRQ0);
    expect((await cpu.readUint32(INTR)) & INTR_SM0_TXNFULL).toEqual(INTR_SM0_TXNFULL);
    await cpu.writeUint32(TXF0, 3);
    await cpu.writeUint32(NVIC_ICPR, PIO_IRQ0);

    // At this point, TX FIFO should be full and the flag/interrupt will be cleared
    expect((await cpu.readUint32(INTR)) & INTR_SM0_TXNFULL).toEqual(0);
    expect((await cpu.readUint32(NVIC_ISPR)) & PIO_IRQ0).toEqual(0);

    // Pull an item, so TX FIFO should be "not empty" again
    await cpu.writeUint32(SM0_INSTR, pioPULL(false, false));
    expect((await cpu.readUint32(INTR)) & INTR_SM0_TXNFULL).toEqual(INTR_SM0_TXNFULL);
    expect((await cpu.readUint32(NVIC_ISPR)) & PIO_IRQ0).toEqual(PIO_IRQ0);
  });

  it('should update RXFNEMPTY flag in INTR according to the level of the RX FIFO (issue #73)', async () => {
    await resetStateMachines();
    await cpu.writeUint32(IRQ0_INTE, INTR_SM0_RXNEMPTY);
    await cpu.writeUint32(NVIC_ICPR, PIO_IRQ0);

    // RX FIFO starts empty
    expect((await cpu.readUint32(INTR)) & INTR_SM0_RXNEMPTY).toEqual(0);
    expect((await cpu.readUint32(NVIC_ISPR)) & PIO_IRQ0).toEqual(0);

    // Push an item so it's no longer empty...
    await cpu.writeUint32(SM0_INSTR, pioPUSH(false, false));
    expect((await cpu.readUint32(INTR)) & INTR_SM0_RXNEMPTY).toEqual(INTR_SM0_RXNEMPTY);
    expect((await cpu.readUint32(NVIC_ISPR)) & PIO_IRQ0).toEqual(PIO_IRQ0);

    // Read the item and it should be empty again
    await cpu.readUint32(RXF0);
    await cpu.writeUint32(NVIC_ICPR, PIO_IRQ0);
    expect((await cpu.readUint32(INTR)) & INTR_SM0_RXNEMPTY).toEqual(0);
    expect((await cpu.readUint32(NVIC_ISPR)) & PIO_IRQ0).toEqual(0);
  });
});
