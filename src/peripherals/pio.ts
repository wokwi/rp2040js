import { RP2040 } from '../rp2040';
import { FIFO } from '../utils/fifo';
import { BasePeripheral, Peripheral } from './peripheral';

// Generic registers
const CTRL = 0x000;
const FSTAT = 0x004;
const FDEBUG = 0x008;
const FLEVEL = 0x00c;
const IRQ = 0x030;
const IRQ_FORCE = 0x034;
const INPUT_SYNC_BYPASS = 0x038;
const DBG_PADOUT = 0x03c;
const DBG_PADOE = 0x040;
const DBG_CFGINFO = 0x044;
const INSTR_MEM0 = 0x48;
const INSTR_MEM31 = 0x0c4;

const INTR = 0x128; // Raw Interrupts
const IRQ0_INTE = 0x12c; // Interrupt Enable for irq0
const IRQ0_INTF = 0x130; // Interrupt Force for irq0
const IRQ0_INTS = 0x134; // Interrupt status after masking & forcing for irq0
const IRQ1_INTE = 0x138; // Interrupt Enable for irq1
const IRQ1_INTF = 0x13c; // Interrupt Force for irq1
const IRQ1_INTS = 0x140; // Interrupt status after masking & forcing for irq1

// State-machine specific registers
const TXF0 = 0x010;
const TXF1 = 0x014;
const TXF2 = 0x018;
const TXF3 = 0x01c;
const RXF0 = 0x020;
const RXF1 = 0x024;
const RXF2 = 0x028;
const RXF3 = 0x02c;
const SM0_CLKDIV = 0x0c8; // Clock divisor register for state machine 0
const SM0_EXECCTRL = 0x0cc; // Execution/behavioural settings for state machine 0
const SM0_SHIFTCTRL = 0x0d0; // Control behaviour of the input/output shift registers for state machine 0
const SM0_ADDR = 0x0d4; // Current instruction address of state machine 0
const SM0_INSTR = 0x0d8; // Write to execute an instruction immediately (including jumps) and then resume execution.
const SM0_PINCTRL = 0x0dc; //State machine pin control
const SM1_CLKDIV = 0x0e0;
const SM1_PINCTRL = 0x0f4;
const SM2_CLKDIV = 0x0f8;
const SM2_PINCTRL = 0x10c;
const SM3_CLKDIV = 0x110;
const SM3_PINCTRL = 0x124;

// FSTAT bits
const FSTAT_TXEMPTY = 1 << 24;
const FSTAT_TXFULL = 1 << 16;
const FSTAT_RXEMPTY = 1 << 8;
const FSTAT_RXFULL = 1 << 0;

// FDEBUG bits
const FDEBUG_TXSTALL = 1 << 24;
const FDEBUG_TXOVER = 1 << 16;
const FDEBUG_RXUNDER = 1 << 8;
const FDEBUG_RXSTALL = 1 << 0;

// SHIFTCTRL bits
const SHIFTCTRL_IN_SHIFTDIR = 1 << 18; // 1 = shift input shift register to right (data enters from left). 0 = to left
const SHIFTCTRL_OUT_SHIFTDIR = 1 << 19; // 1 = shift out of output shift register to right. 0 = to left

function bitReverse(x: number) {
  x = ((x & 0x55555555) << 1) | ((x & 0xaaaaaaaa) >> 1);
  x = ((x & 0x33333333) << 2) | ((x & 0xcccccccc) >> 2);
  x = ((x & 0x0f0f0f0f) << 4) | ((x & 0xf0f0f0f0) >> 4);
  x = ((x & 0x00ff00ff) << 8) | ((x & 0xff00ff00) >> 8);
  x = ((x & 0x0000ffff) << 16) | ((x & 0xffff0000) >> 16);
  return x >>> 0;
}

export class StateMachine {
  enabled = false;

  // State machine registers
  x: number = 0;
  y: number = 0;
  pc: number = 0;
  inputShiftReg = 0;
  inputShiftCount = 0;
  outputShiftReg = 0;
  outputShiftCount = 0;

  exec: number = 0;
  execValid = false;
  updatePC = true;

  clockDivInt: number = 1;
  clockDivFrac: number = 0;
  execCtrl = 0x1f << 12;
  shiftCtrl = 0b11 << 18;
  pinCtrl = 0x5 << 26;
  readonly rxFIFO = new FIFO(4);
  readonly txFIFO = new FIFO(4);

  constructor(readonly rp2040: RP2040, readonly pio: RPPIO, readonly index: number) {}

  writeFifo(value: number) {
    if (!this.txFIFO.full) {
      this.txFIFO.push(value);
    } else {
      this.pio.fdebug |= FDEBUG_TXOVER << this.index;
    }
  }

  readFifo() {
    if (this.rxFIFO.empty) {
      this.pio.fdebug |= FDEBUG_RXUNDER << this.index;
      return 0;
    }
    return this.rxFIFO.pull();
  }

  get status() {
    // TODO
    // The STATUS source has a value of all-ones or all-zeroes, depending on some state machine status such as FIFO
    // full/empty, configured by EXECCTRL_STATUS_SEL.
    return 0;
  }

  jmpCondition(condition: number) {
    switch (condition) {
      // (no condition): Always
      case 0b000:
        return true;

      // !X: scratch X zero
      case 0b001:
        return this.x === 0;

      // X--: scratch X non-zero, post-decrement
      case 0b010: {
        const oldX = this.x;
        this.x = (this.x - 1) >>> 0;
        return oldX !== 0;
      }

      // !Y: scratch Y zero
      case 0b011:
        return this.y === 0;

      // Y--: scratch Y non-zero, post-decrement
      case 0b100: {
        const oldY = this.y;
        this.y = (this.y - 1) >>> 0;
        return oldY !== 0;
      }

      // X!=Y: scratch X not equal scratch Y
      case 0b101:
        return this.x != this.y;

      // PIN: branch on input pin
      case 0b110:
        return false; // TODO

      // !OSRE: output shift register not empty
      case 0b111:
        return this.outputShiftCount > 0;
    }

    this.pio.error(`jmpCondition with unsupported condition: ${condition}`);
    return false;
  }

  get pins() {
    // TODO
    return 0;
  }

  inSourceValue(source: number) {
    switch (source) {
      // PINS
      case 0b000:
        return this.pins;

      // X (scratch register X)
      case 0b001:
        return this.x;

      // Y (scratch register Y)
      case 0b010:
        return this.y;

      // NULL (all zeroes)
      case 0b011:
        return 0;

      // Reserved
      case 0b100:
        return 0;

      // Reserved for IN, STATUS for MOV
      case 0b101:
        return this.status;

      // ISR
      case 0b110:
        return this.inputShiftReg;

      // OSR
      case 0b111:
        return this.outputShiftReg;
    }

    this.pio.error(`inSourceValue with unsupported source: ${source}`);
    return 0;
  }

  writeOutValue(destination: number, value: number, bitCount: number) {
    switch (destination) {
      // PINS
      case 0b000:
        this.setOutPins(value);
        break;

      // X (scratch register X)
      case 0b001:
        this.x = value;
        break;

      // Y (scratch register Y)
      case 0b010:
        this.y = value;
        break;

      // NULL (discard data)
      case 0b011:
        break;

      // PINDIRS
      case 0b100:
        this.setOutPinDirs(value);
        break;

      // PC
      case 0b101:
        this.pc = value & 0x1f;
        this.updatePC = false;
        break;

      // ISR (also sets ISR shift counter to Bit count)
      case 0b110:
        this.inputShiftReg = value;
        this.inputShiftCount = bitCount;
        break;

      // EXEC (Execute OSR shift data as instruction)
      case 0b111:
        this.exec = value;
        this.execValid = true;
        break;
    }
  }

  get pushThreshold() {
    const value = (this.shiftCtrl >> 20) & 0x1f;
    return value ? value : 32;
  }

  get pullThreshold() {
    const value = (this.shiftCtrl >> 25) & 0x1f;
    return value ? value : 32;
  }

  setOutPinDirs(value: number) {
    throw new Error('Method not implemented.');
  }

  setOutPins(value: number) {
    throw new Error('Method not implemented.');
  }

  executeInstruction(opcode: number) {
    const delaySideset = (opcode >> 8) & 0x1f;
    const arg = opcode & 0xff;
    this.updatePC = true;
    switch (opcode >>> 13) {
      /* JMP */
      case 0b000:
        if (this.jmpCondition(arg >> 5)) {
          this.pc = arg & 0x1f;
          this.updatePC = false;
        }
        break;

      /* WAIT */
      case 0b001:
        break;

      /* IN */
      case 0b010: {
        const bitCount = arg & 0x1f;
        const sourceValue = this.inSourceValue(arg >> 5) & ((1 << bitCount) - 1);
        if (bitCount == 0) {
          this.inputShiftReg = sourceValue;
          this.inputShiftCount = 32;
        } else {
          if (this.shiftCtrl & SHIFTCTRL_IN_SHIFTDIR) {
            this.inputShiftReg >>>= bitCount;
            this.inputShiftReg |= sourceValue << (32 - bitCount);
          } else {
            this.inputShiftReg <<= bitCount;
            this.inputShiftReg |= sourceValue;
          }
          this.inputShiftCount += bitCount;
          if (this.inputShiftCount > 32) {
            this.inputShiftCount = 32;
          }
        }
        // TODO
        // If automatic push is enabled, IN will also push the ISR contents to the RX FIFO if the push threshold is reached
        // (SHIFTCTRL_PUSH_THRESH). IN still executes in one cycle, whether an automatic push takes place or not. The state machine
        // will stall if the RX FIFO is full when an automatic push occurs. An automatic push clears the ISR contents to all-zeroes,
        // and clears the input shift count. See Section 3.5.4.
        break;
      }

      /* OUT */
      case 0b011: {
        const bitCount = arg & 0x1f;
        const destination = arg >> 5;
        if (bitCount === 0) {
          this.writeOutValue(destination, this.outputShiftReg, 32);
          this.outputShiftCount = 32;
        } else {
          if (this.shiftCtrl & SHIFTCTRL_OUT_SHIFTDIR) {
            const value = this.outputShiftReg & ((1 << bitCount) - 1);
            this.outputShiftReg >>>= bitCount;
            this.writeOutValue(destination, value, bitCount);
          } else {
            const value = this.outputShiftReg >>> (32 - bitCount);
            this.outputShiftReg <<= bitCount;
            this.writeOutValue(destination, value, bitCount);
          }
          this.outputShiftCount += bitCount;
          if (this.outputShiftCount > 32) {
            this.outputShiftCount = 32;
          }
        }
        // TODO
        // If automatic pull is enabled, the OSR is automatically refilled from the TX FIFO if the pull threshold, SHIFTCTRL_PULL_THRESH,
        // is reached. The output shift count is simultaneously cleared to 0. In this case, the OUT will stall if the TX FIFO is empty,
        // but otherwise still executes in one cycle. The specifics are given in Section 3.5.4.
        break;
      }

      /* PUSH/PULL */
      case 0b100: {
        const block = !(arg & (1 << 5));
        const ifFullOrEmpty = !(arg & (1 << 6));
        if (arg & 0x1f) {
          // Unknown instruction
          break;
        }
        if (arg & 0x80) {
          // PULL
          if (ifFullOrEmpty && this.outputShiftCount < this.pullThreshold) {
            break;
          }
          // TODO When autopull is enabled, any PULL instruction is a no-op when the OSR is full, so that the PULL instruction behaves as
          // a barrier. OUT NULL, 32 can be used to explicitly discard the OSR contents
          if (!this.txFIFO.empty) {
            this.outputShiftReg = this.txFIFO.pull();
          } else {
            if (block) {
              // TODO stall!
              break;
            } else {
              // TODO set FDEBUG_RXSTALL
              this.outputShiftReg = this.x;
            }
          }
          this.outputShiftCount = 0;
        } else {
          // PUSH
          if (ifFullOrEmpty && this.inputShiftCount < this.pushThreshold) {
            break;
          }
          if (!this.rxFIFO.full) {
            this.rxFIFO.push(this.inputShiftReg);
          } else {
            if (block) {
              // TODO stall!
              break;
            } else {
              // TODO set FDEBUG_RXSTALL
            }
          }
          this.inputShiftReg = 0;
          this.inputShiftCount = 0;
        }
        break;
      }

      /* MOV */
      case 0b101: {
        const source = arg & 0x7;
        const op = (arg >> 3) & 0x3;
        const destination = (arg >> 5) & 0x7;
        const value = this.inSourceValue(source);
        const transformedValue = this.transformMovValue(value, op);
        this.setMovDestination(destination, transformedValue);
        break;
      }

      /* IRQ */
      case 0b110:
        if (arg & 0x80) {
          // Unknown instruction
          break;
        }
        break;

      /* SET */
      case 0b111: {
        const data = arg & 0x1f;
        const destination = arg >> 5;
        switch (destination) {
          case 0b000:
            this.setSetPins(data);
            break;
          case 0b001:
            this.x = data;
            break;
          case 0b010:
            this.y = data;
            break;
          case 0b100:
            this.setSetPinDirs(data);
            break;
        }
        break;
      }
    }

    if (this.updatePC) {
      this.pc = (this.pc + 1) & 0x1f;
      // TODO wrap
    }

    // TODO delay, but skip the delay if execValid
  }

  setSetPinDirs(data: number) {
    throw new Error('Method not implemented.');
  }

  setSetPins(data: number) {
    throw new Error('Method not implemented.');
  }

  transformMovValue(value: number, op: number) {
    switch (op) {
      case 0b00:
        return value;
      case 0b01:
        return ~value;
      case 0b10:
        return bitReverse(value);
      case 0b11:
      default:
        return value; // reserved
    }
  }

  setMovDestination(destination: number, value: number) {
    switch (destination) {
      // PINS
      case 0b000:
        this.setOutPins(value);
        break;

      // X (scratch register X)
      case 0b001:
        this.x = value;
        break;

      // Y (scratch register Y)
      case 0b010:
        this.y = value;
        break;

      // reserved (discard data)
      case 0b011:
        break;

      // EXEC
      case 0b100:
        this.exec = value;
        this.execValid = true;
        break;

      // PC
      case 0b101:
        this.pc = value & 0x1f;
        this.updatePC = false;
        break;

      // ISR (Input shift counter is reset to 0 by this operation, i.e. empty)
      case 0b110:
        this.inputShiftReg = value;
        this.inputShiftCount = 0;
        break;

      // OSR (Output shift counter is reset to 0 by this operation, i.e. full)
      case 0b111:
        this.outputShiftReg = value;
        this.outputShiftCount = 0;
        break;
    }
  }

  readUint32(offset: number) {
    switch (offset + SM0_CLKDIV) {
      case SM0_CLKDIV:
        return (this.clockDivInt << 16) | (this.clockDivFrac << 8);
      case SM0_EXECCTRL:
        return this.execCtrl;
      case SM0_SHIFTCTRL:
        return this.shiftCtrl;
      case SM0_ADDR:
        return this.pc;
      case SM0_INSTR:
        return this.pio.instructions[this.pc];
      case SM0_PINCTRL:
        return this.pinCtrl;
    }
    this.pio.error(`Read from invalid state machine register: ${offset}`);
    return 0;
  }

  writeUint32(offset: number, value: number) {
    switch (offset + SM0_CLKDIV) {
      case SM0_CLKDIV:
        this.clockDivFrac = (value >>> 8) & 0xff;
        this.clockDivInt = value >>> 16;
        break;
      case SM0_EXECCTRL:
        this.execCtrl = ((value & 0x7fffffff) | (this.execCtrl & 0x80000000)) >>> 0;
        break;
      case SM0_SHIFTCTRL:
        this.shiftCtrl = value;
        break;
      case SM0_ADDR:
        /* read-only */
        break;
      case SM0_INSTR:
        this.executeInstruction(value & 0xffff);
        break;
      case SM0_PINCTRL:
        this.pinCtrl = value;
        break;
      default:
        this.pio.error(`Write to invalid state machine register: ${offset}`);
    }
  }

  get fifoStat() {
    const result =
      (this.txFIFO.empty ? FSTAT_TXEMPTY : 0) |
      (this.txFIFO.full ? FSTAT_TXFULL : 0) |
      (this.rxFIFO.empty ? FSTAT_RXEMPTY : 0) |
      (this.rxFIFO.full ? FSTAT_RXFULL : 0);
    return result << this.index;
  }

  restart() {
    this.inputShiftCount = 0;
    this.outputShiftCount = 0;
    this.inputShiftReg = 0;
    // TODO the delay counter; the waiting-on-IRQ state;
    // TODO any stalled instruction written to SMx_INSTR or run by OUT/MOV EXEC
    // TODO any pin write left asserted due to OUT_STICKY.
    this.pio.warn('restart not implemented');
  }

  clkDivRestart() {
    this.pio.warn('clkDivRestart not implemented');
  }
}

export class RPPIO extends BasePeripheral implements Peripheral {
  fdebug = 0;

  readonly instructions = new Uint32Array(32);
  readonly machines = [
    new StateMachine(this.rp2040, this, 0),
    new StateMachine(this.rp2040, this, 1),
    new StateMachine(this.rp2040, this, 2),
    new StateMachine(this.rp2040, this, 3),
  ];

  constructor(rp2040: RP2040, name: string) {
    super(rp2040, name);
  }

  readUint32(offset: number) {
    if (offset >= SM0_CLKDIV && offset <= SM0_PINCTRL) {
      return this.machines[0].readUint32(offset - SM0_CLKDIV);
    }
    if (offset >= SM1_CLKDIV && offset <= SM1_PINCTRL) {
      return this.machines[1].readUint32(offset - SM1_CLKDIV);
    }
    if (offset >= SM2_CLKDIV && offset <= SM2_PINCTRL) {
      return this.machines[2].readUint32(offset - SM2_CLKDIV);
    }
    if (offset >= SM3_CLKDIV && offset <= SM3_PINCTRL) {
      return this.machines[3].readUint32(offset - SM3_CLKDIV);
    }

    switch (offset) {
      case CTRL:
        return (
          (this.machines[0].enabled ? 1 << 0 : 0) |
          (this.machines[1].enabled ? 1 << 1 : 0) |
          (this.machines[2].enabled ? 1 << 2 : 0) |
          (this.machines[3].enabled ? 1 << 3 : 0)
        );
      case FSTAT:
        return (
          this.machines[0].fifoStat |
          this.machines[1].fifoStat |
          this.machines[2].fifoStat |
          this.machines[3].fifoStat
        );
      case FDEBUG:
        return this.fdebug;
      case FLEVEL:
        return (
          (this.machines[0].txFIFO.itemCount & 0xf) |
          ((this.machines[0].rxFIFO.itemCount & 0xf) << 4) |
          ((this.machines[1].txFIFO.itemCount & 0xf) << 8) |
          ((this.machines[1].rxFIFO.itemCount & 0xf) << 12) |
          ((this.machines[2].txFIFO.itemCount & 0xf) << 16) |
          ((this.machines[2].rxFIFO.itemCount & 0xf) << 20) |
          ((this.machines[3].txFIFO.itemCount & 0xf) << 24) |
          ((this.machines[3].rxFIFO.itemCount & 0xf) << 28)
        );
      case RXF0:
        return this.machines[0].readFifo();
      case RXF1:
        return this.machines[1].readFifo();
      case RXF2:
        return this.machines[2].readFifo();
      case RXF3:
        return this.machines[3].readFifo();
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    if (offset >= INSTR_MEM0 && offset <= INSTR_MEM31) {
      const index = (offset - INSTR_MEM0) >> 2;
      this.instructions[index] = value & 0xffff;
      return;
    }
    if (offset >= SM0_CLKDIV && offset <= SM0_PINCTRL) {
      this.machines[0].writeUint32(offset - SM0_CLKDIV, value);
      return;
    }
    if (offset >= SM1_CLKDIV && offset <= SM1_PINCTRL) {
      this.machines[1].writeUint32(offset - SM1_CLKDIV, value);
      return;
    }
    if (offset >= SM2_CLKDIV && offset <= SM2_PINCTRL) {
      this.machines[2].writeUint32(offset - SM2_CLKDIV, value);
      return;
    }
    if (offset >= SM3_CLKDIV && offset <= SM3_PINCTRL) {
      this.machines[3].writeUint32(offset - SM3_CLKDIV, value);
      return;
    }
    switch (offset) {
      case CTRL:
        for (let index = 0; index < 4; index++) {
          this.machines[index].enabled = value & (1 << index) ? true : false;
          if (value & (1 << (4 + index))) {
            this.machines[index].restart();
          }
          if (value & (1 << (8 + index))) {
            this.machines[index].clkDivRestart();
          }
        }
        break;
      case FDEBUG:
        this.fdebug &= ~value;
        break;
      case TXF0:
        this.machines[0].writeFifo(value);
        break;
      case TXF1:
        this.machines[1].writeFifo(value);
        break;
      case TXF2:
        this.machines[2].writeFifo(value);
        break;
      case TXF3:
        this.machines[3].writeFifo(value);
        break;

      default:
        super.writeUint32(offset, value);
    }
  }
}
