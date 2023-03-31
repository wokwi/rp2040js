import { RP2040 } from './rp2040';
import { Core } from './core';
import { Interpolator } from './interpolator';
import { FIFO } from './utils/fifo';
import { IRQ } from './irq';

//HARDWARE DIVIDER
const DIV_UDIVIDEND = 0x060; //  Divider unsigned dividend
const DIV_UDIVISOR = 0x064; //  Divider unsigned divisor
const DIV_SDIVIDEND = 0x068; //  Divider signed dividend
const DIV_SDIVISOR = 0x06c; //  Divider signed divisor
const DIV_QUOTIENT = 0x070; //  Divider result quotient
const DIV_REMAINDER = 0x074; //Divider result remainder
const DIV_CSR = 0x078;

//INTERPOLATOR
const INTERP0_ACCUM0 = 0x080; // Read/write access to accumulator 0
const INTERP0_ACCUM1 = 0x084; // Read/write access to accumulator 1
const INTERP0_BASE0 = 0x088; // Read/write access to BASE0 register
const INTERP0_BASE1 = 0x08c; // Read/write access to BASE1 register
const INTERP0_BASE2 = 0x090; // Read/write access to BASE2 register
const INTERP0_POP_LANE0 = 0x094; // Read LANE0 result, and simultaneously write lane results to both accumulators (POP)
const INTERP0_POP_LANE1 = 0x098; // Read LANE1 result, and simultaneously write lane results to both accumulators (POP)
const INTERP0_POP_FULL = 0x09c; // Read FULL result, and simultaneously write lane results to both accumulators (POP)
const INTERP0_PEEK_LANE0 = 0x0a0; // Read LANE0 result, without altering any internal state (PEEK)
const INTERP0_PEEK_LANE1 = 0x0a4; // Read LANE1 result, without altering any internal state (PEEK)
const INTERP0_PEEK_FULL = 0x0a8; // Read FULL result, without altering any internal state (PEEK)
const INTERP0_CTRL_LANE0 = 0x0ac; // Control register for lane 0
const INTERP0_CTRL_LANE1 = 0x0b0; // Control register for lane 1
const INTERP0_ACCUM0_ADD = 0x0b4; // Values written here are atomically added to ACCUM0
const INTERP0_ACCUM1_ADD = 0x0b8; // Values written here are atomically added to ACCUM1
const INTERP0_BASE_1AND0 = 0x0bc; // On write, the lower 16 bits go to BASE0, upper bits to BASE1 simultaneously
const INTERP1_ACCUM0 = 0x0c0; // Read/write access to accumulator 0
const INTERP1_ACCUM1 = 0x0c4; // Read/write access to accumulator 1
const INTERP1_BASE0 = 0x0c8; // Read/write access to BASE0 register
const INTERP1_BASE1 = 0x0cc; // Read/write access to BASE1 register
const INTERP1_BASE2 = 0x0d0; // Read/write access to BASE2 register
const INTERP1_POP_LANE0 = 0x0d4; // Read LANE0 result, and simultaneously write lane results to both accumulators (POP)
const INTERP1_POP_LANE1 = 0x0d8; // Read LANE1 result, and simultaneously write lane results to both accumulators (POP)
const INTERP1_POP_FULL = 0x0dc; // Read FULL result, and simultaneously write lane results to both accumulators (POP)
const INTERP1_PEEK_LANE0 = 0x0e0; // Read LANE0 result, without altering any internal state (PEEK)
const INTERP1_PEEK_LANE1 = 0x0e4; // Read LANE1 result, without altering any internal state (PEEK)
const INTERP1_PEEK_FULL = 0x0e8; // Read FULL result, without altering any internal state (PEEK)
const INTERP1_CTRL_LANE0 = 0x0ec; // Control register for lane 0
const INTERP1_CTRL_LANE1 = 0x0f0; // Control register for lane 1
const INTERP1_ACCUM0_ADD = 0x0f4; // Values written here are atomically added to ACCUM0
const INTERP1_ACCUM1_ADD = 0x0f8; // Values written here are atomically added to ACCUM1
const INTERP1_BASE_1AND0 = 0x0fc; // On write, the lower 16 bits go to BASE0, upper bits to BASE1 simultaneously

// FIFO
const FIFO_ST_VLD_BITS = 0x01;
const FIFO_ST_RDY_BITS = 0x02;
const FIFO_ST_WOF_BITS = 0x04;
const FIFO_ST_ROE_BITS = 0x08;

const FIFO_ST = 0x50;
const FIFO_WR = 0x54;
const FIFO_RD = 0x58;

export class RPSIOCore {
  divDividend = 0;
  divDivisor = 1;
  divQuotient = 0;
  divRemainder = 0;
  divCSR = 0;

  interp0 = new Interpolator(0);
  interp1 = new Interpolator(1);

  ROE = false;
  WOF = false;

  static create2Cores(rp2040: RP2040) {
    const rxFIFO = new FIFO(8);
    const txFIFO = new FIFO(8);
    const core0 = new RPSIOCore(rp2040, rxFIFO, txFIFO, Core.Core0);
    const core1 = new RPSIOCore(rp2040, txFIFO, rxFIFO, Core.Core1);
    return [core0, core1];
  }

  private constructor(
    private readonly rp2040: RP2040,
    private readonly rxFIFO: FIFO,
    private readonly txFIFO: FIFO,
    private readonly core: Core
  ) {}

  readUint32(offset: number) {
    switch (offset) {
      case DIV_UDIVIDEND:
        return this.divDividend;
      case DIV_SDIVIDEND:
        return this.divDividend;
      case DIV_UDIVISOR:
        return this.divDivisor;
      case DIV_SDIVISOR:
        return this.divDivisor;
      case DIV_QUOTIENT:
        this.divCSR &= ~0b10;
        return this.divQuotient;
      case DIV_REMAINDER:
        return this.divRemainder;
      case DIV_CSR:
        return this.divCSR;
      case INTERP0_ACCUM0:
        return this.interp0.accum0;
      case INTERP0_ACCUM1:
        return this.interp0.accum1;
      case INTERP0_BASE0:
        return this.interp0.base0;
      case INTERP0_BASE1:
        return this.interp0.base1;
      case INTERP0_BASE2:
        return this.interp0.base2;
      case INTERP0_CTRL_LANE0:
        return this.interp0.ctrl0;
      case INTERP0_CTRL_LANE1:
        return this.interp0.ctrl1;
      case INTERP0_PEEK_LANE0:
        return this.interp0.result0;
      case INTERP0_PEEK_LANE1:
        return this.interp0.result1;
      case INTERP0_PEEK_FULL:
        return this.interp0.result2;
      case INTERP0_POP_LANE0: {
        const value = this.interp0.result0;
        this.interp0.writeback();
        return value;
      }
      case INTERP0_POP_LANE1: {
        const value = this.interp0.result1;
        this.interp0.writeback();
        return value;
      }
      case INTERP0_POP_FULL: {
        const value = this.interp0.result2;
        this.interp0.writeback();
        return value;
      }
      case INTERP0_ACCUM0_ADD:
        return this.interp0.smresult0;
      case INTERP0_ACCUM1_ADD:
        return this.interp0.smresult1;
      case INTERP1_ACCUM0:
        return this.interp1.accum0;
      case INTERP1_ACCUM1:
        return this.interp1.accum1;
      case INTERP1_BASE0:
        return this.interp1.base0;
      case INTERP1_BASE1:
        return this.interp1.base1;
      case INTERP1_BASE2:
        return this.interp1.base2;
      case INTERP1_CTRL_LANE0:
        return this.interp1.ctrl0;
      case INTERP1_CTRL_LANE1:
        return this.interp1.ctrl1;
      case INTERP1_PEEK_LANE0:
        return this.interp1.result0;
      case INTERP1_PEEK_LANE1:
        return this.interp1.result1;
      case INTERP1_PEEK_FULL:
        return this.interp1.result2;
      case INTERP1_POP_LANE0: {
        const value = this.interp1.result0;
        this.interp1.writeback();
        return value;
      }
      case INTERP1_POP_LANE1: {
        const value = this.interp1.result1;
        this.interp1.writeback();
        return value;
      }
      case INTERP1_POP_FULL: {
        const value = this.interp1.result2;
        this.interp1.writeback();
        return value;
      }
      case INTERP1_ACCUM0_ADD:
        return this.interp1.smresult0;
      case INTERP1_ACCUM1_ADD:
        return this.interp1.smresult1;
      case FIFO_ST: {
        let value = 0;
        if (!this.rxFIFO.empty) {
          value |= FIFO_ST_VLD_BITS;
        }
        if (!this.txFIFO.full) {
          value |= FIFO_ST_RDY_BITS;
        }
        if (this.WOF) {
          value |= FIFO_ST_WOF_BITS;
        }
        if (this.ROE) {
          value |= FIFO_ST_ROE_BITS;
        }
        return value;
      }
      case FIFO_RD:
        if (this.rxFIFO.empty) {
          this.ROE = true;
          switch (this.core) {
            case Core.Core0:
              this.rp2040.setInterruptCore(IRQ.SIO_PROC0, true, Core.Core0);
              break;
            case Core.Core1:
              this.rp2040.setInterruptCore(IRQ.SIO_PROC1, true, Core.Core1);
          }
          return 0;
        }
        return this.rxFIFO.pull();
      default:
        console.warn(`Read from invalid SIO address: ${offset.toString(16)} (${this.core})`);
        return 0xffffffff;
    }
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case DIV_UDIVIDEND:
        this.divDividend = value;
        this.updateHardwareDivider(false);
        break;
      case DIV_SDIVIDEND:
        this.divDividend = value;
        this.updateHardwareDivider(true);
        break;
      case DIV_UDIVISOR:
        this.divDivisor = value;
        this.updateHardwareDivider(false);
        break;
      case DIV_SDIVISOR:
        this.divDivisor = value;
        this.updateHardwareDivider(true);
        break;
      case DIV_QUOTIENT:
        this.divQuotient = value;
        this.divCSR = 0b11;
        break;
      case DIV_REMAINDER:
        this.divRemainder = value;
        this.divCSR = 0b11;
        break;
      case INTERP0_ACCUM0:
        this.interp0.accum0 = value;
        this.interp0.update();
        break;
      case INTERP0_ACCUM1:
        this.interp0.accum1 = value;
        this.interp0.update();
        break;
      case INTERP0_BASE0:
        this.interp0.base0 = value;
        this.interp0.update();
        break;
      case INTERP0_BASE1:
        this.interp0.base1 = value;
        this.interp0.update();
        break;
      case INTERP0_BASE2:
        this.interp0.base2 = value;
        this.interp0.update();
        break;
      case INTERP0_CTRL_LANE0:
        this.interp0.ctrl0 = value;
        this.interp0.update();
        break;
      case INTERP0_CTRL_LANE1:
        this.interp0.ctrl1 = value;
        this.interp0.update();
        break;
      case INTERP0_ACCUM0_ADD:
        this.interp0.accum0 += value;
        this.interp0.update();
        break;
      case INTERP0_ACCUM1_ADD:
        this.interp0.accum1 += value;
        this.interp0.update();
        break;
      case INTERP0_BASE_1AND0:
        this.interp0.setBase01(value);
        break;
      case INTERP1_ACCUM0:
        this.interp1.accum0 = value;
        this.interp1.update();
        break;
      case INTERP1_ACCUM1:
        this.interp1.accum1 = value;
        this.interp1.update();
        break;
      case INTERP1_BASE0:
        this.interp1.base0 = value;
        this.interp1.update();
        break;
      case INTERP1_BASE1:
        this.interp1.base1 = value;
        this.interp1.update();
        break;
      case INTERP1_BASE2:
        this.interp1.base2 = value;
        this.interp1.update();
        break;
      case INTERP1_CTRL_LANE0:
        this.interp1.ctrl0 = value;
        this.interp1.update();
        break;
      case INTERP1_CTRL_LANE1:
        this.interp1.ctrl1 = value;
        this.interp1.update();
        break;
      case INTERP1_ACCUM0_ADD:
        this.interp1.accum0 += value;
        this.interp1.update();
        break;
      case INTERP1_ACCUM1_ADD:
        this.interp1.accum1 += value;
        this.interp1.update();
        break;
      case INTERP1_BASE_1AND0:
        this.interp1.setBase01(value);
        break;
      case FIFO_ST:
        if (value | FIFO_ST_WOF_BITS) {
          this.WOF = false;
        }
        if (value | FIFO_ST_ROE_BITS) {
          this.ROE = false;
        }
        if (!this.WOF && !this.ROE && this.rxFIFO.empty) {
          switch (this.core) {
            case Core.Core0:
              this.rp2040.setInterruptCore(IRQ.SIO_PROC0, false, Core.Core0);
              break;
            case Core.Core1:
              this.rp2040.setInterruptCore(IRQ.SIO_PROC1, false, Core.Core1);
              break;
          }
        }
        break;
      case FIFO_WR:
        if (this.txFIFO.full) {
          this.WOF = true;
          switch (this.core) {
            case Core.Core0:
              this.rp2040.setInterruptCore(IRQ.SIO_PROC0, true, Core.Core0);
              break;
            case Core.Core1:
              this.rp2040.setInterruptCore(IRQ.SIO_PROC1, true, Core.Core1);
              break;
          }
        } else {
          this.txFIFO.push(value);
          switch (this.core) {
            case Core.Core0:
              this.rp2040.setInterruptCore(IRQ.SIO_PROC1, true, Core.Core1);
              break;
            case Core.Core1:
              this.rp2040.setInterruptCore(IRQ.SIO_PROC0, true, Core.Core0);
              break;
          }
        }
        break;
      default:
        console.warn(
          `Write to invalid SIO address: ${offset.toString(16)}, value=${value.toString(16)} (${
            this.core
          })`
        );
        break;
    }
  }

  private updateHardwareDivider(signed: boolean) {
    if (this.divDivisor == 0) {
      this.divQuotient = this.divDividend > 0 ? -1 : 1;
      this.divRemainder = this.divDividend;
    } else {
      if (signed) {
        this.divQuotient = (this.divDividend | 0) / (this.divDivisor | 0);
        this.divRemainder = (this.divDividend | 0) % (this.divDivisor | 0);
      } else {
        this.divQuotient = (this.divDividend >>> 0) / (this.divDivisor >>> 0);
        this.divRemainder = (this.divDividend >>> 0) % (this.divDivisor >>> 0);
      }
    }
    this.divCSR = 0b11;
    switch (this.core) {
      case Core.Core0:
        this.rp2040.core0.cycles += 8;
        break;
      case Core.Core1:
        this.rp2040.core1.cycles += 8;
        break;
    }
  }
}
