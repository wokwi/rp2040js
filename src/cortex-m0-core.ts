import { MAX_HARDWARE_IRQ } from './irq.js';
import { APB_START_ADDRESS, RP2040, SIO_START_ADDRESS } from './rp2040.js';

/* eslint-disable @typescript-eslint/no-unused-vars */
const EXC_RESET = 1;
const EXC_NMI = 2;
const EXC_HARDFAULT = 3;
const EXC_SVCALL = 11;
const EXC_PENDSV = 14;
const EXC_SYSTICK = 15;

const SYSM_APSR = 0;
const SYSM_IAPSR = 1;
const SYSM_EAPSR = 2;
const SYSM_XPSR = 3;
const SYSM_IPSR = 5;
const SYSM_EPSR = 6;
const SYSM_IEPSR = 7;
export const SYSM_MSP = 8;
export const SYSM_PSP = 9;
export const SYSM_PRIMASK = 16;
export const SYSM_CONTROL = 20;

/* eslint-enable @typescript-eslint/no-unused-vars */

// Lowest possible exception priority
const LOWEST_PRIORITY = 4;

enum ExecutionMode {
  Mode_Thread,
  Mode_Handler,
}

function signExtend8(value: number) {
  return (value << 24) >> 24;
}

function signExtend16(value: number) {
  return (value << 16) >> 16;
}

const spRegister = 13;
const pcRegister = 15;

enum StackPointerBank {
  SPmain,
  SPprocess,
}

const LOG_NAME = 'CortexM0Core';

export class CortexM0Core {
  readonly registers = new Uint32Array(16);
  bankedSP: number = 0;
  cycles: number = 0;

  eventRegistered = false;
  waiting = false;

  // APSR fields
  public N: boolean = false;
  public C: boolean = false;
  public Z: boolean = false;
  public V: boolean = false;

  // How many bytes to rewind the last break instruction
  public breakRewind = 0;

  // PRIMASK fields
  public PM: boolean = false;

  // CONTROL fields
  public SPSEL: StackPointerBank = StackPointerBank.SPmain;
  public nPRIV: boolean = false;

  currentMode: ExecutionMode = ExecutionMode.Mode_Thread;
  public IPSR: number = 0;
  public interruptNMIMask = 0;
  pendingInterrupts: number = 0;
  enabledInterrupts: number = 0;
  interruptPriorities = [0xffffffff, 0x0, 0x0, 0x0];
  pendingNMI: boolean = false;
  pendingPendSV: boolean = false;
  pendingSVCall: boolean = false;
  pendingSystick: boolean = false;
  interruptsUpdated = false;
  VTOR = 0;
  SHPR2 = 0;
  SHPR3 = 0;

  /** Hook to listen for function calls - branch-link (BL/BLX) instructions */
  blTaken = (core: CortexM0Core, blx: boolean) => {
    void core; // surpress unused variable warnings
    void blx;
  };

  constructor(readonly rp2040: RP2040) {
    this.SP = 0xfffffffc;
    this.bankedSP = 0xfffffffc;
  }

  get logger() {
    return this.rp2040.logger;
  }

  reset() {
    this.SP = this.rp2040.readUint32(this.VTOR);
    this.PC = this.rp2040.readUint32(this.VTOR + 4) & 0xfffffffe;
    this.cycles = 0;
  }

  get SP() {
    return this.registers[13];
  }

  set SP(value: number) {
    this.registers[13] = value & ~0x3;
  }

  get LR() {
    return this.registers[14];
  }

  set LR(value: number) {
    this.registers[14] = value;
  }

  get PC() {
    return this.registers[15];
  }

  set PC(value: number) {
    this.registers[15] = value;
  }

  get APSR() {
    return (
      (this.N ? 0x80000000 : 0) |
      (this.Z ? 0x40000000 : 0) |
      (this.C ? 0x20000000 : 0) |
      (this.V ? 0x10000000 : 0)
    );
  }

  set APSR(value: number) {
    this.N = !!(value & 0x80000000);
    this.Z = !!(value & 0x40000000);
    this.C = !!(value & 0x20000000);
    this.V = !!(value & 0x10000000);
  }

  get xPSR() {
    return this.APSR | this.IPSR | (1 << 24);
  }

  set xPSR(value: number) {
    this.APSR = value;
    this.IPSR = value & 0x3f;
  }

  checkCondition(cond: number) {
    // Evaluate base condition.
    let result = false;
    switch (cond >> 1) {
      case 0b000:
        result = this.Z;
        break;
      case 0b001:
        result = this.C;
        break;
      case 0b010:
        result = this.N;
        break;
      case 0b011:
        result = this.V;
        break;
      case 0b100:
        result = this.C && !this.Z;
        break;
      case 0b101:
        result = this.N === this.V;
        break;
      case 0b110:
        result = this.N === this.V && !this.Z;
        break;
      case 0b111:
        result = true;
        break;
    }
    return cond & 0b1 && cond != 0b1111 ? !result : result;
  }

  readUint32(address: number) {
    return this.rp2040.readUint32(address);
  }

  readUint16(address: number) {
    return this.rp2040.readUint16(address);
  }

  readUint8(address: number) {
    return this.rp2040.readUint8(address);
  }

  writeUint32(address: number, value: number) {
    this.rp2040.writeUint32(address, value);
  }

  writeUint16(address: number, value: number) {
    this.rp2040.writeUint16(address, value);
  }

  writeUint8(address: number, value: number) {
    this.rp2040.writeUint8(address, value);
  }

  switchStack(stack: StackPointerBank) {
    if (this.SPSEL !== stack) {
      const temp = this.SP;
      this.SP = this.bankedSP;
      this.bankedSP = temp;
      this.SPSEL = stack;
    }
  }

  get SPprocess() {
    return this.SPSEL === StackPointerBank.SPprocess ? this.SP : this.bankedSP;
  }

  set SPprocess(value: number) {
    if (this.SPSEL === StackPointerBank.SPprocess) {
      this.SP = value;
    } else {
      this.bankedSP = value >>> 0;
    }
  }

  get SPmain() {
    return this.SPSEL === StackPointerBank.SPmain ? this.SP : this.bankedSP;
  }

  set SPmain(value: number) {
    if (this.SPSEL === StackPointerBank.SPmain) {
      this.SP = value;
    } else {
      this.bankedSP = value >>> 0;
    }
  }

  exceptionEntry(exceptionNumber: number) {
    // PushStack:
    let framePtr = 0;
    let framePtrAlign = 0;
    if (this.SPSEL && this.currentMode === ExecutionMode.Mode_Thread) {
      framePtrAlign = this.SPprocess & 0b100 ? 1 : 0;
      this.SPprocess = (this.SPprocess - 0x20) & ~0b100;
      framePtr = this.SPprocess;
    } else {
      framePtrAlign = this.SPmain & 0b100 ? 1 : 0;
      this.SPmain = (this.SPmain - 0x20) & ~0b100;
      framePtr = this.SPmain;
    }
    /* only the stack locations, not the store order, are architected */
    this.writeUint32(framePtr, this.registers[0]);
    this.writeUint32(framePtr + 0x4, this.registers[1]);
    this.writeUint32(framePtr + 0x8, this.registers[2]);
    this.writeUint32(framePtr + 0xc, this.registers[3]);
    this.writeUint32(framePtr + 0x10, this.registers[12]);
    this.writeUint32(framePtr + 0x14, this.LR);
    this.writeUint32(framePtr + 0x18, this.PC & ~1); // ReturnAddress(ExceptionType);
    this.writeUint32(framePtr + 0x1c, (this.xPSR & ~(1 << 9)) | (framePtrAlign << 9));
    if (this.currentMode == ExecutionMode.Mode_Handler) {
      this.LR = 0xfffffff1;
    } else {
      if (!this.SPSEL) {
        this.LR = 0xfffffff9;
      } else {
        this.LR = 0xfffffffd;
      }
    }
    // ExceptionTaken:
    this.currentMode = ExecutionMode.Mode_Handler; // Enter Handler Mode, now Privileged
    this.IPSR = exceptionNumber;
    this.switchStack(StackPointerBank.SPmain);
    this.eventRegistered = true;
    const vectorTable = this.VTOR;
    this.PC = this.readUint32(vectorTable + 4 * exceptionNumber);
  }

  exceptionReturn(excReturn: number) {
    let framePtr = this.SPmain;
    switch (excReturn & 0xf) {
      case 0b0001: // Return to Handler
        this.currentMode = ExecutionMode.Mode_Handler;
        this.switchStack(StackPointerBank.SPmain);
        break;
      case 0b1001: // Return to Thread using Main stack
        this.currentMode = ExecutionMode.Mode_Thread;
        this.switchStack(StackPointerBank.SPmain);
        break;
      case 0b1101: // Return to Thread using Process stack
        framePtr = this.SPprocess;
        this.currentMode = ExecutionMode.Mode_Thread;
        this.switchStack(StackPointerBank.SPprocess);
        break;
      // Assigning CurrentMode to Mode_Thread causes a drop in privilege
      // if CONTROL.nPRIV is set to 1
    }

    // PopStack:
    this.registers[0] = this.readUint32(framePtr); // Stack accesses are performed as Unprivileged accesses if
    this.registers[1] = this.readUint32(framePtr + 0x4); // CONTROL<0>=='1' && EXC_RETURN<3>=='1' Privileged otherwise
    this.registers[2] = this.readUint32(framePtr + 0x8);
    this.registers[3] = this.readUint32(framePtr + 0xc);
    this.registers[12] = this.readUint32(framePtr + 0x10);
    this.LR = this.readUint32(framePtr + 0x14);
    this.PC = this.readUint32(framePtr + 0x18);
    const psr = this.readUint32(framePtr + 0x1c);

    const framePtrAlign = psr & (1 << 9) ? 0b100 : 0;

    switch (excReturn & 0xf) {
      case 0b0001: // Returning to Handler mode
        this.SPmain = (this.SPmain + 0x20) | framePtrAlign;
        break;

      case 0b1001: // Returning to Thread mode using Main stack
        this.SPmain = (this.SPmain + 0x20) | framePtrAlign;
        break;

      case 0b1101: // Returning to Thread mode using Process stack
        this.SPprocess = (this.SPprocess + 0x20) | framePtrAlign;
        break;
    }

    this.APSR = psr & 0xf0000000;
    const forceThread = this.currentMode == ExecutionMode.Mode_Thread && this.nPRIV;
    this.IPSR = forceThread ? 0 : psr & 0x3f;
    this.interruptsUpdated = true;
    // Thumb bit should always be one! EPSR<24> = psr<24>; // Load valid EPSR bits from memory
    this.eventRegistered = true;
    // if CurrentMode == Mode_Thread && SCR.SLEEPONEXIT == '1' then
    // SleepOnExit(); // IMPLEMENTATION DEFINED
  }

  get pendSVPriority() {
    return (this.SHPR3 >> 22) & 0x3;
  }

  get svCallPriority() {
    return this.SHPR2 >>> 30;
  }

  get systickPriority() {
    return this.SHPR3 >>> 30;
  }

  exceptionPriority(n: number) {
    switch (n) {
      case EXC_RESET:
        return -3;
      case EXC_NMI:
        return -2;
      case EXC_HARDFAULT:
        return -1;
      case EXC_SVCALL:
        return this.svCallPriority;
      case EXC_PENDSV:
        return this.pendSVPriority;
      case EXC_SYSTICK:
        return this.systickPriority;
      default: {
        if (n < 16) {
          return LOWEST_PRIORITY;
        }
        const intNum = n - 16;
        for (let priority = 0; priority < 4; priority++) {
          if (this.interruptPriorities[priority] & (1 << intNum)) {
            return priority;
          }
        }
        return LOWEST_PRIORITY;
      }
    }
  }

  get vectPending() {
    if (this.pendingNMI) {
      return EXC_NMI;
    }
    const { svCallPriority, systickPriority, pendSVPriority, pendingInterrupts } = this;
    for (let priority = 0; priority < LOWEST_PRIORITY; priority++) {
      const levelInterrupts = pendingInterrupts & this.interruptPriorities[priority];
      if (this.pendingSVCall && priority === svCallPriority) {
        return EXC_SVCALL;
      }
      if (this.pendingPendSV && priority === pendSVPriority) {
        return EXC_PENDSV;
      }
      if (this.pendingSystick && priority === systickPriority) {
        return EXC_SYSTICK;
      }
      if (levelInterrupts) {
        for (let interruptNumber = 0; interruptNumber < 32; interruptNumber++) {
          if (levelInterrupts & (1 << interruptNumber)) {
            return 16 + interruptNumber;
          }
        }
      }
    }
    return 0;
  }

  setInterrupt(irq: number, value: boolean) {
    const irqBit = 1 << irq;
    if (value && !(this.pendingInterrupts & irqBit)) {
      this.pendingInterrupts |= irqBit;
      this.interruptsUpdated = true;
      if (this.waiting && this.checkForInterrupts()) {
        this.waiting = false;
      }
    } else if (!value) {
      this.pendingInterrupts &= ~irqBit;
    }
  }

  checkForInterrupts() {
    /* If we're waiting for an interrupt (i.e. WFI/WFE), the ARM says:
       > If PRIMASK.PM is set to 1, an asynchronous exception that has a higher group priority than any
       > active exception results in a WFI instruction exit. If the group priority of the exception is less than or
       > equal to the execution group priority, the exception is ignored.
    */
    const currentPriority = this.waiting
      ? this.PM
        ? this.exceptionPriority(this.IPSR)
        : LOWEST_PRIORITY
      : Math.min(this.exceptionPriority(this.IPSR), this.PM ? 0 : LOWEST_PRIORITY);
    const interruptSet = this.pendingInterrupts & this.enabledInterrupts;
    const { svCallPriority, systickPriority, pendSVPriority } = this;
    if (this.pendingNMI) {
      this.pendingNMI = false;
      this.exceptionEntry(EXC_NMI);
      return true;
    }
    for (let priority = 0; priority < currentPriority; priority++) {
      const levelInterrupts = interruptSet & this.interruptPriorities[priority];
      if (this.pendingSVCall && priority === svCallPriority) {
        this.pendingSVCall = false;
        this.exceptionEntry(EXC_SVCALL);
        return true;
      }
      if (this.pendingPendSV && priority === pendSVPriority) {
        this.pendingPendSV = false;
        this.exceptionEntry(EXC_PENDSV);
        return true;
      }
      if (this.pendingSystick && priority === systickPriority) {
        this.pendingSystick = false;
        this.exceptionEntry(EXC_SYSTICK);
        return true;
      }
      if (levelInterrupts) {
        for (let interruptNumber = 0; interruptNumber < 32; interruptNumber++) {
          if (levelInterrupts & (1 << interruptNumber)) {
            if (interruptNumber > MAX_HARDWARE_IRQ) {
              this.pendingInterrupts &= ~(1 << interruptNumber);
            }
            this.exceptionEntry(16 + interruptNumber);
            return true;
          }
        }
      }
    }
    this.interruptsUpdated = false;
    return false;
  }

  readSpecialRegister(sysm: number) {
    switch (sysm) {
      case SYSM_APSR:
        return this.APSR;

      case SYSM_XPSR:
        return this.xPSR;

      case SYSM_IPSR:
        return this.IPSR;

      case SYSM_PRIMASK:
        return this.PM ? 1 : 0;

      case SYSM_MSP:
        return this.SPmain;

      case SYSM_PSP:
        return this.SPprocess;

      case SYSM_CONTROL:
        return (this.SPSEL === StackPointerBank.SPprocess ? 2 : 0) | (this.nPRIV ? 1 : 0);

      default:
        this.logger.warn(LOG_NAME, `MRS with unimplemented SYSm value: ${sysm}`);
        return 0;
    }
  }

  writeSpecialRegister(sysm: number, value: number) {
    switch (sysm) {
      case SYSM_APSR:
        this.APSR = value;
        break;

      case SYSM_XPSR:
        this.xPSR = value;
        break;

      case SYSM_IPSR:
        this.IPSR = value;
        break;

      case SYSM_PRIMASK:
        this.PM = !!(value & 1);
        this.interruptsUpdated = true;
        break;

      case SYSM_MSP:
        this.SPmain = value;
        break;

      case SYSM_PSP:
        this.SPprocess = value;
        break;

      case SYSM_CONTROL:
        this.nPRIV = !!(value & 1);
        if (this.currentMode === ExecutionMode.Mode_Thread) {
          this.switchStack(value & 2 ? StackPointerBank.SPprocess : StackPointerBank.SPmain);
        }
        break;

      default:
        this.logger.warn(LOG_NAME, `MRS with unimplemented SYSm value: ${sysm}`);
        return 0;
    }
  }

  BXWritePC(address: number) {
    if (this.currentMode == ExecutionMode.Mode_Handler && address >>> 28 == 0b1111) {
      this.exceptionReturn(address & 0x0fffffff);
    } else {
      this.PC = address & ~1;
    }
  }

  private substractUpdateFlags(minuend: number, subtrahend: number) {
    const result = minuend - subtrahend;
    this.N = !!(result & 0x80000000);
    this.Z = (result & 0xffffffff) === 0;
    this.C = minuend >= subtrahend;
    this.V =
      (!!(result & 0x80000000) && !(minuend & 0x80000000) && !!(subtrahend & 0x80000000)) ||
      (!(result & 0x80000000) && !!(minuend & 0x80000000) && !(subtrahend & 0x80000000));
    return result;
  }

  private addUpdateFlags(addend1: number, addend2: number) {
    const unsignedSum = (addend1 + addend2) >>> 0;
    const signedSum = (addend1 | 0) + (addend2 | 0);
    const result = addend1 + addend2;
    this.N = !!(result & 0x80000000);
    this.Z = (result & 0xffffffff) === 0;
    this.C = result === unsignedSum ? false : true;
    this.V = (result | 0) === signedSum ? false : true;
    return result & 0xffffffff;
  }

  cyclesIO(addr: number, write = false) {
    addr = addr >>> 0;
    if (addr >= SIO_START_ADDRESS && addr < SIO_START_ADDRESS + 0x10000000) {
      return 0;
    }
    if (addr >= APB_START_ADDRESS && addr < APB_START_ADDRESS + 0x10000000) {
      return write ? 4 : 3;
    }
    return 1;
  }

  executeInstruction() {
    if (this.interruptsUpdated) {
      if (this.checkForInterrupts()) {
        this.waiting = false;
      }
    }
    // ARM Thumb instruction encoding - 16 bits / 2 bytes
    const opcodePC = this.PC & ~1; //ensure no LSB set PC are executed
    const opcode = this.readUint16(opcodePC);
    const wideInstruction = opcode >> 12 === 0b1111 || opcode >> 11 === 0b11101;
    const opcode2 = wideInstruction ? this.readUint16(opcodePC + 2) : 0;
    this.PC += 2;
    let deltaCycles = 1;
    // ADCS
    if (opcode >> 6 === 0b0100000101) {
      const Rm = (opcode >> 3) & 0x7;
      const Rdn = opcode & 0x7;
      this.registers[Rdn] = this.addUpdateFlags(
        this.registers[Rm],
        this.registers[Rdn] + (this.C ? 1 : 0),
      );
    }
    // ADD (register = SP plus immediate)
    else if (opcode >> 11 === 0b10101) {
      const imm8 = opcode & 0xff;
      const Rd = (opcode >> 8) & 0x7;
      this.registers[Rd] = this.SP + (imm8 << 2);
    }
    // ADD (SP plus immediate)
    else if (opcode >> 7 === 0b101100000) {
      const imm32 = (opcode & 0x7f) << 2;
      this.SP += imm32;
    }
    // ADDS (Encoding T1)
    else if (opcode >> 9 === 0b0001110) {
      const imm3 = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      this.registers[Rd] = this.addUpdateFlags(this.registers[Rn], imm3);
    }
    // ADDS (Encoding T2)
    else if (opcode >> 11 === 0b00110) {
      const imm8 = opcode & 0xff;
      const Rdn = (opcode >> 8) & 0x7;
      this.registers[Rdn] = this.addUpdateFlags(this.registers[Rdn], imm8);
    }
    // ADDS (register)
    else if (opcode >> 9 === 0b0001100) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      this.registers[Rd] = this.addUpdateFlags(this.registers[Rn], this.registers[Rm]);
    }
    // ADD (register)
    else if (opcode >> 8 === 0b01000100) {
      const Rm = (opcode >> 3) & 0xf;
      const Rdn = ((opcode & 0x80) >> 4) | (opcode & 0x7);
      const leftValue = Rdn === pcRegister ? this.PC + 2 : this.registers[Rdn];
      const rightValue = this.registers[Rm];
      const result = leftValue + rightValue;
      if (Rdn !== spRegister && Rdn !== pcRegister) {
        this.registers[Rdn] = result;
      } else if (Rdn === pcRegister) {
        this.registers[Rdn] = result & ~0x1;
        deltaCycles++;
      } else if (Rdn === spRegister) {
        this.registers[Rdn] = result & ~0x3;
      }
    }
    // ADR
    else if (opcode >> 11 === 0b10100) {
      const imm8 = opcode & 0xff;
      const Rd = (opcode >> 8) & 0x7;
      this.registers[Rd] = (opcodePC & 0xfffffffc) + 4 + (imm8 << 2);
    }
    // ANDS (Encoding T2)
    else if (opcode >> 6 === 0b0100000000) {
      const Rm = (opcode >> 3) & 0x7;
      const Rdn = opcode & 0x7;
      const result = this.registers[Rdn] & this.registers[Rm];
      this.registers[Rdn] = result;
      this.N = !!(result & 0x80000000);
      this.Z = (result & 0xffffffff) === 0;
    }
    // ASRS (immediate)
    else if (opcode >> 11 === 0b00010) {
      const imm5 = (opcode >> 6) & 0x1f;
      const Rm = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      const input = this.registers[Rm];
      const shiftN = imm5 ? imm5 : 32;
      const result = shiftN < 32 ? input >> shiftN : (input & 0x80000000) >> 31;
      this.registers[Rd] = result;
      this.N = !!(result & 0x80000000);
      this.Z = (result & 0xffffffff) === 0;
      this.C = input & (1 << (shiftN - 1)) ? true : false;
    }
    // ASRS (register)
    else if (opcode >> 6 === 0b0100000100) {
      const Rm = (opcode >> 3) & 0x7;
      const Rdn = opcode & 0x7;
      const input = this.registers[Rdn];
      const shiftN = (this.registers[Rm] & 0xff) < 32 ? this.registers[Rm] & 0xff : 32;
      const result = shiftN < 32 ? input >> shiftN : (input & 0x80000000) >> 31;
      this.registers[Rdn] = result;
      this.N = !!(result & 0x80000000);
      this.Z = (result & 0xffffffff) === 0;
      this.C = input & (1 << (shiftN - 1)) ? true : false;
    }
    // B (with cond)
    else if (opcode >> 12 === 0b1101 && ((opcode >> 9) & 0x7) !== 0b111) {
      let imm8 = (opcode & 0xff) << 1;
      const cond = (opcode >> 8) & 0xf;
      if (imm8 & (1 << 8)) {
        imm8 = (imm8 & 0x1ff) - 0x200;
      }
      if (this.checkCondition(cond)) {
        this.PC += imm8 + 2;
        deltaCycles++;
      }
    }
    // B
    else if (opcode >> 11 === 0b11100) {
      let imm11 = (opcode & 0x7ff) << 1;
      if (imm11 & (1 << 11)) {
        imm11 = (imm11 & 0x7ff) - 0x800;
      }
      this.PC += imm11 + 2;
      deltaCycles++;
    }
    // BICS
    else if (opcode >> 6 === 0b0100001110) {
      const Rm = (opcode >> 3) & 0x7;
      const Rdn = opcode & 0x7;
      const result = (this.registers[Rdn] &= ~this.registers[Rm]);
      this.N = !!(result & 0x80000000);
      this.Z = result === 0;
    }
    // BKPT
    else if (opcode >> 8 === 0b10111110) {
      const imm8 = opcode & 0xff;
      this.breakRewind = 2;
      this.rp2040.onBreak(imm8);
    }
    // BL
    else if (opcode >> 11 === 0b11110 && opcode2 >> 14 === 0b11 && ((opcode2 >> 12) & 0x1) == 1) {
      const imm11 = opcode2 & 0x7ff;
      const J2 = (opcode2 >> 11) & 0x1;
      const J1 = (opcode2 >> 13) & 0x1;
      const imm10 = opcode & 0x3ff;
      const S = (opcode >> 10) & 0x1;
      const I1 = 1 - (S ^ J1);
      const I2 = 1 - (S ^ J2);
      const imm32 =
        ((S ? 0b11111111 : 0) << 24) | ((I1 << 23) | (I2 << 22) | (imm10 << 12) | (imm11 << 1));
      this.LR = (this.PC + 2) | 0x1;
      this.PC += 2 + imm32;
      deltaCycles += 2;
      this.blTaken(this, false);
    }
    // BLX
    else if (opcode >> 7 === 0b010001111 && (opcode & 0x7) === 0) {
      const Rm = (opcode >> 3) & 0xf;
      this.LR = this.PC | 0x1;
      this.PC = this.registers[Rm] & ~1;
      deltaCycles++;
      this.blTaken(this, true);
    }
    // BX
    else if (opcode >> 7 === 0b010001110 && (opcode & 0x7) === 0) {
      const Rm = (opcode >> 3) & 0xf;
      this.BXWritePC(this.registers[Rm]);
      deltaCycles++;
    }
    // CMN (register)
    else if (opcode >> 6 === 0b0100001011) {
      const Rm = (opcode >> 3) & 0x7;
      const Rn = opcode & 0x7;
      this.addUpdateFlags(this.registers[Rn], this.registers[Rm]);
    }
    // CMP immediate
    else if (opcode >> 11 === 0b00101) {
      const Rn = (opcode >> 8) & 0x7;
      const imm8 = opcode & 0xff;
      this.substractUpdateFlags(this.registers[Rn], imm8);
    }
    // CMP (register)
    else if (opcode >> 6 === 0b0100001010) {
      const Rm = (opcode >> 3) & 0x7;
      const Rn = opcode & 0x7;
      this.substractUpdateFlags(this.registers[Rn], this.registers[Rm]);
    }
    // CMP (register) encoding T2
    else if (opcode >> 8 === 0b01000101) {
      const Rm = (opcode >> 3) & 0xf;
      const Rn = ((opcode >> 4) & 0x8) | (opcode & 0x7);
      this.substractUpdateFlags(this.registers[Rn], this.registers[Rm]);
    }
    // CPSID i
    else if (opcode === 0xb672) {
      this.PM = true;
    }
    // CPSIE i
    else if (opcode === 0xb662) {
      this.PM = false;
      this.interruptsUpdated = true;
    }
    // DMB SY
    else if (opcode === 0xf3bf && (opcode2 & 0xfff0) === 0x8f50) {
      this.PC += 2;
      deltaCycles += 2;
    }
    // DSB SY
    else if (opcode === 0xf3bf && (opcode2 & 0xfff0) === 0x8f40) {
      this.PC += 2;
      deltaCycles += 2;
    }
    // EORS
    else if (opcode >> 6 === 0b0100000001) {
      const Rm = (opcode >> 3) & 0x7;
      const Rdn = opcode & 0x7;
      const result = this.registers[Rm] ^ this.registers[Rdn];
      this.registers[Rdn] = result;
      this.N = !!(result & 0x80000000);
      this.Z = result === 0;
    }
    // ISB SY
    else if (opcode === 0xf3bf && (opcode2 & 0xfff0) === 0x8f60) {
      this.PC += 2;
      deltaCycles += 2;
    }
    // LDMIA
    else if (opcode >> 11 === 0b11001) {
      const Rn = (opcode >> 8) & 0x7;
      const registers = opcode & 0xff;
      let address = this.registers[Rn];
      for (let i = 0; i < 8; i++) {
        if (registers & (1 << i)) {
          this.registers[i] = this.readUint32(address);
          address += 4;
          deltaCycles++;
        }
      }
      // Write back
      if (!(registers & (1 << Rn))) {
        this.registers[Rn] = address;
      }
    }
    // LDR (immediate)
    else if (opcode >> 11 === 0b01101) {
      const imm5 = ((opcode >> 6) & 0x1f) << 2;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rn] + imm5;
      deltaCycles += this.cyclesIO(addr);
      this.registers[Rt] = this.readUint32(addr);
    }
    // LDR (sp + immediate)
    else if (opcode >> 11 === 0b10011) {
      const Rt = (opcode >> 8) & 0x7;
      const imm8 = opcode & 0xff;
      const addr = this.SP + (imm8 << 2);
      deltaCycles += this.cyclesIO(addr);
      this.registers[Rt] = this.readUint32(addr);
    }
    // LDR (literal)
    else if (opcode >> 11 === 0b01001) {
      const imm8 = (opcode & 0xff) << 2;
      const Rt = (opcode >> 8) & 7;
      const nextPC = this.PC + 2;
      const addr = (nextPC & 0xfffffffc) + imm8;
      deltaCycles += this.cyclesIO(addr);
      this.registers[Rt] = this.readUint32(addr);
    }
    // LDR (register)
    else if (opcode >> 9 === 0b0101100) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
      deltaCycles += this.cyclesIO(addr);
      this.registers[Rt] = this.readUint32(addr);
    }
    // LDRB (immediate)
    else if (opcode >> 11 === 0b01111) {
      const imm5 = (opcode >> 6) & 0x1f;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rn] + imm5;
      deltaCycles += this.cyclesIO(addr);
      this.registers[Rt] = this.readUint8(addr);
    }
    // LDRB (register)
    else if (opcode >> 9 === 0b0101110) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
      deltaCycles += this.cyclesIO(addr);
      this.registers[Rt] = this.readUint8(addr);
    }
    // LDRH (immediate)
    else if (opcode >> 11 === 0b10001) {
      const imm5 = (opcode >> 6) & 0x1f;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rn] + (imm5 << 1);
      deltaCycles += this.cyclesIO(addr);
      this.registers[Rt] = this.readUint16(addr);
    }
    // LDRH (register)
    else if (opcode >> 9 === 0b0101101) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
      deltaCycles += this.cyclesIO(addr);
      this.registers[Rt] = this.readUint16(addr);
    }
    // LDRSB
    else if (opcode >> 9 === 0b0101011) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
      deltaCycles += this.cyclesIO(addr);
      this.registers[Rt] = signExtend8(this.readUint8(addr));
    }
    // LDRSH
    else if (opcode >> 9 === 0b0101111) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
      deltaCycles += this.cyclesIO(addr);
      this.registers[Rt] = signExtend16(this.readUint16(addr));
    }
    // LSLS (immediate)
    else if (opcode >> 11 === 0b00000) {
      const imm5 = (opcode >> 6) & 0x1f;
      const Rm = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      const input = this.registers[Rm];
      const result = input << imm5;
      this.registers[Rd] = result;
      this.N = !!(result & 0x80000000);
      this.Z = result === 0;
      this.C = imm5 ? !!(input & (1 << (32 - imm5))) : this.C;
    }
    // LSLS (register)
    else if (opcode >> 6 === 0b0100000010) {
      const Rm = (opcode >> 3) & 0x7;
      const Rdn = opcode & 0x7;
      const input = this.registers[Rdn];
      const shiftCount = this.registers[Rm] & 0xff;
      const result = shiftCount >= 32 ? 0 : input << shiftCount;
      this.registers[Rdn] = result;
      this.N = !!(result & 0x80000000);
      this.Z = result === 0;
      this.C = shiftCount ? !!(input & (1 << (32 - shiftCount))) : this.C;
    }
    // LSRS (immediate)
    else if (opcode >> 11 === 0b00001) {
      const imm5 = (opcode >> 6) & 0x1f;
      const Rm = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      const input = this.registers[Rm];
      const result = imm5 ? input >>> imm5 : 0;
      this.registers[Rd] = result;
      this.N = !!(result & 0x80000000);
      this.Z = result === 0;
      this.C = !!((input >>> (imm5 ? imm5 - 1 : 31)) & 0x1);
    }
    // LSRS (register)
    else if (opcode >> 6 === 0b0100000011) {
      const Rm = (opcode >> 3) & 0x7;
      const Rdn = opcode & 0x7;
      const shiftAmount = this.registers[Rm] & 0xff;
      const input = this.registers[Rdn];
      const result = shiftAmount < 32 ? input >>> shiftAmount : 0;
      this.registers[Rdn] = result;
      this.N = !!(result & 0x80000000);
      this.Z = result === 0;
      this.C = shiftAmount <= 32 ? !!((input >>> (shiftAmount - 1)) & 0x1) : false;
    }
    // MOV
    else if (opcode >> 8 === 0b01000110) {
      const Rm = (opcode >> 3) & 0xf;
      const Rd = ((opcode >> 4) & 0x8) | (opcode & 0x7);
      let value = Rm === pcRegister ? this.PC + 2 : this.registers[Rm];
      if (Rd === pcRegister) {
        deltaCycles++;
        value &= ~1;
      } else if (Rd === spRegister) {
        value &= ~3;
      }
      this.registers[Rd] = value;
    }
    // MOVS
    else if (opcode >> 11 === 0b00100) {
      const value = opcode & 0xff;
      const Rd = (opcode >> 8) & 7;
      this.registers[Rd] = value;
      this.N = !!(value & 0x80000000);
      this.Z = value === 0;
    }
    // MRS
    else if (opcode === 0b1111001111101111 && opcode2 >> 12 == 0b1000) {
      const SYSm = opcode2 & 0xff;
      const Rd = (opcode2 >> 8) & 0xf;
      this.registers[Rd] = this.readSpecialRegister(SYSm);
      this.PC += 2;
      deltaCycles += 2;
    }
    // MSR
    else if (opcode >> 4 === 0b111100111000 && opcode2 >> 8 == 0b10001000) {
      const SYSm = opcode2 & 0xff;
      const Rn = opcode & 0xf;
      this.writeSpecialRegister(SYSm, this.registers[Rn]);
      this.PC += 2;
      deltaCycles += 2;
    }
    // MULS
    else if (opcode >> 6 === 0b0100001101) {
      const Rn = (opcode >> 3) & 0x7;
      const Rdm = opcode & 0x7;
      const result = Math.imul(this.registers[Rn], this.registers[Rdm]);
      this.registers[Rdm] = result;
      this.N = !!(result & 0x80000000);
      this.Z = (result & 0xffffffff) === 0;
    }
    // MVNS
    else if (opcode >> 6 === 0b0100001111) {
      const Rm = (opcode >> 3) & 7;
      const Rd = opcode & 7;
      const result = ~this.registers[Rm];
      this.registers[Rd] = result;
      this.N = !!(result & 0x80000000);
      this.Z = result === 0;
    }
    // ORRS (Encoding T2)
    else if (opcode >> 6 === 0b0100001100) {
      const Rm = (opcode >> 3) & 0x7;
      const Rdn = opcode & 0x7;
      const result = this.registers[Rdn] | this.registers[Rm];
      this.registers[Rdn] = result;
      this.N = !!(result & 0x80000000);
      this.Z = (result & 0xffffffff) === 0;
    }
    // POP
    else if (opcode >> 9 === 0b1011110) {
      const P = (opcode >> 8) & 1;
      let address = this.SP;
      for (let i = 0; i <= 7; i++) {
        if (opcode & (1 << i)) {
          this.registers[i] = this.readUint32(address);
          address += 4;
          deltaCycles++;
        }
      }
      if (P) {
        this.SP = address + 4;
        this.BXWritePC(this.readUint32(address));
        deltaCycles += 2;
      } else {
        this.SP = address;
      }
    }
    // PUSH
    else if (opcode >> 9 === 0b1011010) {
      let bitCount = 0;
      for (let i = 0; i <= 8; i++) {
        if (opcode & (1 << i)) {
          bitCount++;
        }
      }
      let address = this.SP - 4 * bitCount;
      for (let i = 0; i <= 7; i++) {
        if (opcode & (1 << i)) {
          this.writeUint32(address, this.registers[i]);
          deltaCycles++;
          address += 4;
        }
      }
      if (opcode & (1 << 8)) {
        this.writeUint32(address, this.registers[14]);
      }
      this.SP -= 4 * bitCount;
    }
    // REV
    else if (opcode >> 6 === 0b1011101000) {
      const Rm = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      const input = this.registers[Rm];
      this.registers[Rd] =
        ((input & 0xff) << 24) |
        (((input >> 8) & 0xff) << 16) |
        (((input >> 16) & 0xff) << 8) |
        ((input >> 24) & 0xff);
    }
    // REV16
    else if (opcode >> 6 === 0b1011101001) {
      const Rm = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      const input = this.registers[Rm];
      this.registers[Rd] =
        (((input >> 16) & 0xff) << 24) |
        (((input >> 24) & 0xff) << 16) |
        ((input & 0xff) << 8) |
        ((input >> 8) & 0xff);
    }
    // REVSH
    else if (opcode >> 6 === 0b1011101011) {
      const Rm = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      const input = this.registers[Rm];
      this.registers[Rd] = signExtend16(((input & 0xff) << 8) | ((input >> 8) & 0xff));
    }
    // ROR
    else if (opcode >> 6 === 0b0100000111) {
      const Rm = (opcode >> 3) & 0x7;
      const Rdn = opcode & 0x7;
      const input = this.registers[Rdn];
      const shift = (this.registers[Rm] & 0xff) % 32;
      const result = (input >>> shift) | (input << (32 - shift));
      this.registers[Rdn] = result;
      this.N = !!(result & 0x80000000);
      this.Z = result === 0;
      this.C = !!(result & 0x80000000);
    }
    // NEGS / RSBS
    else if (opcode >> 6 === 0b0100001001) {
      const Rn = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      this.registers[Rd] = this.substractUpdateFlags(0, this.registers[Rn]);
    }
    // NOP
    else if (opcode === 0b1011111100000000) {
      // Do nothing!
    }
    // SBCS (Encoding T1)
    else if (opcode >> 6 === 0b0100000110) {
      const Rm = (opcode >> 3) & 0x7;
      const Rdn = opcode & 0x7;
      this.registers[Rdn] = this.substractUpdateFlags(
        this.registers[Rdn],
        this.registers[Rm] + (1 - (this.C ? 1 : 0)),
      );
    }
    // SEV
    else if (opcode === 0b1011111101000000) {
      this.logger.info(LOG_NAME, 'SEV');
    }
    // STMIA
    else if (opcode >> 11 === 0b11000) {
      const Rn = (opcode >> 8) & 0x7;
      const registers = opcode & 0xff;
      let address = this.registers[Rn];
      for (let i = 0; i < 8; i++) {
        if (registers & (1 << i)) {
          this.writeUint32(address, this.registers[i]);
          address += 4;
          deltaCycles++;
        }
      }
      // Write back
      if (!(registers & (1 << Rn))) {
        this.registers[Rn] = address;
      }
    }
    // STR (immediate)
    else if (opcode >> 11 === 0b01100) {
      const imm5 = ((opcode >> 6) & 0x1f) << 2;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rn] + imm5;
      deltaCycles += this.cyclesIO(address, true);
      this.writeUint32(address, this.registers[Rt]);
    }
    // STR (sp + immediate)
    else if (opcode >> 11 === 0b10010) {
      const Rt = (opcode >> 8) & 0x7;
      const imm8 = opcode & 0xff;
      const address = this.SP + (imm8 << 2);
      deltaCycles += this.cyclesIO(address, true);
      this.writeUint32(address, this.registers[Rt]);
    }
    // STR (register)
    else if (opcode >> 9 === 0b0101000) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rm] + this.registers[Rn];
      deltaCycles += this.cyclesIO(address, true);
      this.writeUint32(address, this.registers[Rt]);
    }
    // STRB (immediate)
    else if (opcode >> 11 === 0b01110) {
      const imm5 = (opcode >> 6) & 0x1f;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rn] + imm5;
      deltaCycles += this.cyclesIO(address, true);
      this.writeUint8(address, this.registers[Rt]);
    }
    // STRB (register)
    else if (opcode >> 9 === 0b0101010) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rm] + this.registers[Rn];
      deltaCycles += this.cyclesIO(address, true);
      this.writeUint8(address, this.registers[Rt]);
    }
    // STRH (immediate)
    else if (opcode >> 11 === 0b10000) {
      const imm5 = ((opcode >> 6) & 0x1f) << 1;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rn] + imm5;
      deltaCycles += this.cyclesIO(address, true);
      this.writeUint16(address, this.registers[Rt]);
    }
    // STRH (register)
    else if (opcode >> 9 === 0b0101001) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rm] + this.registers[Rn];
      deltaCycles += this.cyclesIO(address, true);
      this.writeUint16(address, this.registers[Rt]);
    }
    // SUB (SP minus immediate)
    else if (opcode >> 7 === 0b101100001) {
      const imm32 = (opcode & 0x7f) << 2;
      this.SP -= imm32;
    }
    // SUBS (Encoding T1)
    else if (opcode >> 9 === 0b0001111) {
      const imm3 = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      this.registers[Rd] = this.substractUpdateFlags(this.registers[Rn], imm3);
    }
    // SUBS (Encoding T2)
    else if (opcode >> 11 === 0b00111) {
      const imm8 = opcode & 0xff;
      const Rdn = (opcode >> 8) & 0x7;
      this.registers[Rdn] = this.substractUpdateFlags(this.registers[Rdn], imm8);
    }
    // SUBS (register)
    else if (opcode >> 9 === 0b0001101) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      this.registers[Rd] = this.substractUpdateFlags(this.registers[Rn], this.registers[Rm]);
    }
    // SVC
    else if (opcode >> 8 === 0b11011111) {
      this.pendingSVCall = true;
      this.interruptsUpdated = true;
    }
    // SXTB
    else if (opcode >> 6 === 0b1011001001) {
      const Rm = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      this.registers[Rd] = signExtend8(this.registers[Rm]);
    }
    // SXTH
    else if (opcode >> 6 === 0b1011001000) {
      const Rm = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      this.registers[Rd] = signExtend16(this.registers[Rm]);
    }
    // TST
    else if (opcode >> 6 == 0b0100001000) {
      const Rm = (opcode >> 3) & 0x7;
      const Rn = opcode & 0x7;
      const result = this.registers[Rn] & this.registers[Rm];
      this.N = !!(result & 0x80000000);
      this.Z = result === 0;
    }
    // UDF
    else if (opcode >> 8 == 0b11011110) {
      const imm8 = opcode & 0xff;
      this.breakRewind = 2;
      this.rp2040.onBreak(imm8);
    }
    // UDF (Encoding T2)
    else if (opcode >> 4 === 0b111101111111 && opcode2 >> 12 === 0b1010) {
      const imm4 = opcode & 0xf;
      const imm12 = opcode2 & 0xfff;
      this.breakRewind = 4;
      this.rp2040.onBreak((imm4 << 12) | imm12);
      this.PC += 2;
    }
    // UXTB
    else if (opcode >> 6 == 0b1011001011) {
      const Rm = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      this.registers[Rd] = this.registers[Rm] & 0xff;
    }
    // UXTH
    else if (opcode >> 6 == 0b1011001010) {
      const Rm = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      this.registers[Rd] = this.registers[Rm] & 0xffff;
    }
    // WFE
    else if (opcode === 0b1011111100100000) {
      deltaCycles++;
      if (this.eventRegistered) {
        this.eventRegistered = false;
      } else {
        this.waiting = true;
      }
    }
    // WFI
    else if (opcode === 0b1011111100110000) {
      deltaCycles++;
      this.waiting = true;
    }
    // YIELD
    else if (opcode === 0b1011111100010000) {
      // do nothing for now. Wait for event!
      this.logger.info(LOG_NAME, 'Yield');
    } else {
      this.logger.warn(
        LOG_NAME,
        `Warning: Instruction at ${opcodePC.toString(16)} is not implemented yet!`,
      );
      this.logger.warn(LOG_NAME, `Opcode: 0x${opcode.toString(16)} (0x${opcode2.toString(16)})`);
    }

    this.cycles += deltaCycles;
    return deltaCycles;
  }
}
