import { Peripheral, UnimplementedPeripheral } from './peripherals/peripheral';
import { RP2040SysCfg } from './peripherals/syscfg';
import { RPTimer } from './peripherals/timer';
import { RPUART } from './peripherals/uart';

export const FLASH_START_ADDRESS = 0x10000000;
export const FLASH_END_ADDRESS = 0x14000000;
export const RAM_START_ADDRESS = 0x20000000;
export const SIO_START_ADDRESS = 0xd0000000;

const SIO_CPUID_OFFSET = 0;

const XIP_SSI_BASE = 0x18000000;
const SSI_SR_OFFSET = 0x00000028;
const SSI_DR0_OFFSET = 0x00000060;
const SSI_SR_BUSY_BITS = 0x00000001;
const SSI_SR_TFE_BITS = 0x00000004;
const CLOCKS_BASE = 0x40008000;
const CLK_REF_SELECTED = 0x38;
const CLK_SYS_SELECTED = 0x44;

const PPB_BASE = 0xe0000000;
const OFFSET_NVIC_ISER = 0xe100; // Interrupt Set-Enable Register
const OFFSET_NVIC_ICER = 0xe180; // Interrupt Clear-Enable Register
const OFFSET_NVIC_ISPR = 0xe200; // Interrupt Set-Pending Register
const OFFSET_NVIC_ICPR = 0xe280; // Interrupt Clear-Pending Register
// Interrupt priority registers
const OFFSET_NVIC_IPRn = [0xe400, 0xe404, 0xe408, 0xe40c, 0xe410, 0xe414, 0xe418, 0xe41c];
const OFFSET_VTOR = 0xed08;
const OFFSET_SHPR2 = 0xed1c;
const OFFSET_SHPR3 = 0xed20;

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

// Lowest possible exception priority
const LOWEST_PRIORITY = 4;

enum ExecutionMode {
  Mode_Thread,
  Mode_Handler,
}

export type CPUWriteCallback = (address: number, value: number) => void;
export type CPUReadCallback = (address: number) => number;

function signExtend8(value: number) {
  return (value << 24) >> 24;
}

function signExtend16(value: number) {
  return (value << 16) >> 16;
}

const pcRegister = 15;

enum StackPointerBank {
  SPmain,
  SPprocess,
}

export class RP2040 {
  readonly bootrom = new Uint32Array(4 * 1024);
  readonly sram = new Uint8Array(264 * 1024);
  readonly sramView = new DataView(this.sram.buffer);
  readonly flash = new Uint8Array(16 * 1024 * 1024);
  readonly flash16 = new Uint16Array(this.flash.buffer);
  readonly flashView = new DataView(this.flash.buffer);
  readonly registers = new Uint32Array(16);
  bankedSP: number = 0;

  readonly writeHooks = new Map<number, CPUWriteCallback>();
  readonly readHooks = new Map<number, CPUReadCallback>();

  readonly uart = [new RPUART(this, 'UART0'), new RPUART(this, 'UART1')];

  private stopped = false;

  // APSR fields
  public N: boolean = false;
  public C: boolean = false;
  public Z: boolean = false;
  public V: boolean = false;

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
  pendingSVCall: boolean = false;
  interruptsUpdated = false;

  private executeTimer: NodeJS.Timeout | null = null;

  readonly peripherals: { [index: number]: Peripheral } = {
    0x40000: new UnimplementedPeripheral(this, 'SYSINFO_BASE'),
    0x40004: new RP2040SysCfg(this, 'SYSCFG'),
    0x40008: new UnimplementedPeripheral(this, 'CLOCKS_BASE'),
    0x4000c: new UnimplementedPeripheral(this, 'RESETS_BASE'),
    0x40010: new UnimplementedPeripheral(this, 'PSM_BASE'),
    0x40014: new UnimplementedPeripheral(this, 'IO_BANK0_BASE'),
    0x40018: new UnimplementedPeripheral(this, 'IO_QSPI_BASE'),
    0x4001c: new UnimplementedPeripheral(this, 'PADS_BANK0_BASE'),
    0x40020: new UnimplementedPeripheral(this, 'PADS_QSPI_BASE'),
    0x40024: new UnimplementedPeripheral(this, 'XOSC_BASE'),
    0x40028: new UnimplementedPeripheral(this, 'PLL_SYS_BASE'),
    0x4002c: new UnimplementedPeripheral(this, 'PLL_USB_BASE'),
    0x40030: new UnimplementedPeripheral(this, 'BUSCTRL_BASE'),
    0x40034: this.uart[0],
    0x40038: this.uart[1],
    0x4003c: new UnimplementedPeripheral(this, 'SPI0_BASE'),
    0x40040: new UnimplementedPeripheral(this, 'SPI1_BASE'),
    0x40044: new UnimplementedPeripheral(this, 'I2C0_BASE'),
    0x40048: new UnimplementedPeripheral(this, 'I2C1_BASE'),
    0x4004c: new UnimplementedPeripheral(this, 'ADC_BASE'),
    0x40050: new UnimplementedPeripheral(this, 'PWM_BASE'),
    0x40054: new RPTimer(this, 'TIMER_BASE'),
    0x40058: new UnimplementedPeripheral(this, 'WATCHDOG_BASE'),
    0x4005c: new UnimplementedPeripheral(this, 'RTC_BASE'),
    0x40060: new UnimplementedPeripheral(this, 'ROSC_BASE'),
    0x40064: new UnimplementedPeripheral(this, 'VREG_AND_CHIP_RESET_BASE'),
    0x4006c: new UnimplementedPeripheral(this, 'TBMAN_BASE'),
  };

  // Debugging
  public onBreak = (code: number) => {
    // TODO: raise HardFault exception
    // console.error('Breakpoint!', code);
    this.stopped = true;
  };

  constructor() {
    this.SP = 0xfffffffc;
    this.bankedSP = 0xfffffffc;
    this.readHooks.set(SIO_START_ADDRESS + SIO_CPUID_OFFSET, () => {
      // Returns the current CPU core id (always 0 for now)
      return 0;
    });
    this.readHooks.set(XIP_SSI_BASE + SSI_SR_OFFSET, () => {
      return SSI_SR_TFE_BITS;
    });

    let dr0 = 0;
    this.writeHooks.set(XIP_SSI_BASE + SSI_DR0_OFFSET, (value) => {
      const CMD_READ_STATUS = 0x05;
      if (value === CMD_READ_STATUS) {
        dr0 = 0; // tell stage2 that we completed a write
      }
    });
    this.readHooks.set(XIP_SSI_BASE + SSI_DR0_OFFSET, () => {
      return dr0;
    });

    this.readHooks.set(CLOCKS_BASE + CLK_REF_SELECTED, () => 1);
    this.readHooks.set(CLOCKS_BASE + CLK_SYS_SELECTED, () => 1);

    let VTOR = 0;
    this.writeHooks.set(PPB_BASE + OFFSET_VTOR, (newValue) => {
      VTOR = newValue;
    });
    this.readHooks.set(PPB_BASE + OFFSET_VTOR, () => {
      return VTOR;
    });

    this.writeHooks.set(PPB_BASE + OFFSET_NVIC_ISPR, (newValue) => {
      this.pendingInterrupts |= newValue;
      this.interruptsUpdated = true;
    });
    this.writeHooks.set(PPB_BASE + OFFSET_NVIC_ICPR, (newValue) => {
      this.pendingInterrupts &= ~newValue;
    });
    this.writeHooks.set(PPB_BASE + OFFSET_NVIC_ISER, (newValue) => {
      this.enabledInterrupts |= newValue;
      this.interruptsUpdated = true;
    });
    this.writeHooks.set(PPB_BASE + OFFSET_NVIC_ICER, (newValue) => {
      this.enabledInterrupts &= ~newValue;
    });

    /* NVIC */
    this.readHooks.set(PPB_BASE + OFFSET_NVIC_ISPR, () => this.pendingInterrupts);
    this.readHooks.set(PPB_BASE + OFFSET_NVIC_ICPR, () => this.pendingInterrupts);
    this.readHooks.set(PPB_BASE + OFFSET_NVIC_ISER, () => this.enabledInterrupts);
    this.readHooks.set(PPB_BASE + OFFSET_NVIC_ICER, () => this.enabledInterrupts);
    for (let regIndex = 0; regIndex < 8; regIndex++) {
      this.writeHooks.set(PPB_BASE + OFFSET_NVIC_IPRn[regIndex], (newValue) => {
        for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
          const interruptNumber = regIndex * 4 + byteIndex;
          const newPriority = (newValue >> (8 * byteIndex + 6)) & 0x3;
          for (let priority = 0; priority < this.interruptPriorities.length; priority++) {
            this.interruptPriorities[priority] &= ~(1 << interruptNumber);
          }
          this.interruptPriorities[newPriority] |= 1 << interruptNumber;
        }
        this.interruptsUpdated = true;
      });
      this.readHooks.set(PPB_BASE + OFFSET_NVIC_IPRn[regIndex], () => {
        let result = 0;
        for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
          const interruptNumber = regIndex * 4 + byteIndex;
          for (let priority = 0; priority < this.interruptPriorities.length; priority++) {
            if (this.interruptPriorities[priority] & (1 << interruptNumber)) {
              result |= priority << (8 * byteIndex + 6);
            }
          }
        }
        return result;
      });
    }
  }

  loadBootrom(bootromData: Uint32Array) {
    this.bootrom.set(bootromData);
    this.reset();
  }

  reset() {
    this.SP = this.bootrom[0];
    this.PC = this.bootrom[1] & 0xfffffffe;
    this.flash.fill(0xff);
  }

  get SP() {
    return this.registers[13];
  }

  set SP(value: number) {
    this.registers[13] = value;
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
      (this.N ? 0x8000000 : 0) |
      (this.Z ? 0x4000000 : 0) |
      (this.C ? 0x2000000 : 0) |
      (this.V ? 0x1000000 : 0)
    );
  }

  set APSR(value: number) {
    this.N = !!(value & 0x8000000);
    this.Z = !!(value & 0x4000000);
    this.C = !!(value & 0x2000000);
    this.V = !!(value & 0x1000000);
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
    const { bootrom } = this;
    if (address & 0x3) {
      throw new Error(`read from address ${address.toString(16)}, which is not 32 bit aligned`);
    }
    address = address >>> 0; // round to 32-bits, unsigned
    const peripheral = this.findPeripheral(address);
    if (peripheral) {
      return peripheral.readUint32(address & 0x3fff);
    }
    if (address < bootrom.length * 4) {
      return bootrom[address / 4];
    } else if (address >= FLASH_START_ADDRESS && address < FLASH_END_ADDRESS) {
      return this.flashView.getUint32(address - FLASH_START_ADDRESS, true);
    } else if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      return this.sramView.getUint32(address - RAM_START_ADDRESS, true);
    } else {
      const hook = this.readHooks.get(address);
      if (hook) {
        return hook(address);
      }
    }
    console.warn(`Read from invalid memory address: ${address.toString(16)}`);
    return 0xffffffff;
  }

  findPeripheral(address: number) {
    return this.peripherals[(address >>> 14) << 2];
  }

  /** We assume the address is 16-bit aligned */
  readUint16(address: number) {
    const value = this.readUint32(address & 0xfffffffc);
    return address & 0x2 ? (value & 0xffff0000) >>> 16 : value & 0xffff;
  }

  readUint8(address: number) {
    const value = this.readUint16(address & 0xfffffffe);
    return (address & 0x1 ? (value & 0xff00) >>> 8 : value & 0xff) >>> 0;
  }

  writeUint32(address: number, value: number) {
    const { bootrom } = this;
    const peripheral = this.findPeripheral(address);
    if (peripheral) {
      peripheral.writeUint32(address & 0x3fff, value);
    } else if (address < bootrom.length * 4) {
      bootrom[address / 4] = value;
    } else if (address >= FLASH_START_ADDRESS && address < FLASH_END_ADDRESS) {
      this.flashView.setUint32(address - FLASH_START_ADDRESS, value, true);
    } else if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      this.sramView.setUint32(address - RAM_START_ADDRESS, value, true);
    } else if (address >= SIO_START_ADDRESS && address < SIO_START_ADDRESS + 0x10000000) {
      const sioAddress = address - SIO_START_ADDRESS;
      // SIO write
      let pinList = [];
      for (let i = 0; i < 32; i++) {
        if (value & (1 << i)) {
          pinList.push(i);
        }
      }
      if (sioAddress === 20) {
        console.log(`GPIO pins ${pinList} set to HIGH`);
      } else if (sioAddress === 24) {
        console.log(`GPIO pins ${pinList} set to LOW`);
      }
    } else {
      const hook = this.writeHooks.get(address);
      if (hook) {
        hook(value, address);
      } else {
        console.error(`Write to undefined address: ${address.toString(16)}`);
      }
    }
  }

  writeUint8(address: number, value: number) {
    const alignedAddress = address & 0xfffffffc;
    const offset = address & 0x3;
    const peripheral = this.findPeripheral(address);
    if (peripheral) {
      peripheral.writeUint32(
        alignedAddress & 0x3fff,
        (value & 0xff) | ((value & 0xff) << 8) | ((value & 0xff) << 16) | ((value & 0xff) << 24)
      );
      return;
    }
    const originalValue = this.readUint32(alignedAddress);
    const newValue = new Uint32Array([originalValue]);
    new DataView(newValue.buffer).setUint8(offset, value);
    this.writeUint32(alignedAddress, newValue[0]);
  }

  writeUint16(address: number, value: number) {
    // we assume that addess is 16-bit aligned.
    // Ideally we should generate a fault if not!
    const alignedAddress = address & 0xfffffffc;
    const offset = address & 0x3;
    const peripheral = this.findPeripheral(address);
    if (peripheral) {
      peripheral.writeUint32(alignedAddress & 0x3fff, (value & 0xffff) | ((value & 0xffff) << 16));
      return;
    }
    const originalValue = this.readUint32(alignedAddress);
    const newValue = new Uint32Array([originalValue]);
    new DataView(newValue.buffer).setUint16(offset, value, true);
    this.writeUint32(alignedAddress, newValue[0]);
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
    // SetEventRegister(); // See WFE instruction for details
    const vectorTable = this.readUint32(PPB_BASE + OFFSET_VTOR);
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
      case 0b1001: // Returning to Thread mode using Main stack
        this.SPmain = (this.SPmain + 0x20) | framePtrAlign;
      case 0b1101: // Returning to Thread mode using Process stack
        this.SPprocess = (this.SPprocess + 0x20) | framePtrAlign;
    }

    this.APSR = psr & 0xf0000000;
    const forceThread = this.currentMode == ExecutionMode.Mode_Thread && this.nPRIV;
    this.IPSR = forceThread ? 0 : psr & 0x3f;
    // Thumb bit should always be one! EPSR<24> = psr<24>; // Load valid EPSR bits from memory
    // SetEventRegister(); // See WFE instruction for more details
    // if CurrentMode == Mode_Thread && SCR.SLEEPONEXIT == '1' then
    // SleepOnExit(); // IMPLEMENTATION DEFINED
  }

  get svCallPriority() {
    return this.readUint32(PPB_BASE + OFFSET_SHPR2) >>> 30;
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
        return (this.readUint32(PPB_BASE + OFFSET_SHPR3) >> 22) & 0x3;
      case EXC_SYSTICK:
        return this.readUint32(PPB_BASE + OFFSET_SHPR3) >>> 30;
      default:
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

  checkForInterrupts() {
    const currentPriority = Math.min(
      this.exceptionPriority(this.IPSR),
      this.PM ? 0 : LOWEST_PRIORITY
    );
    const interruptSet = this.pendingInterrupts & this.enabledInterrupts;
    const { svCallPriority } = this;
    for (let priority = 0; priority < currentPriority; priority++) {
      const levelInterrupts = interruptSet & this.interruptPriorities[priority];
      if (this.pendingSVCall && priority === svCallPriority) {
        this.pendingSVCall = false;
        this.exceptionEntry(EXC_SVCALL);
        return;
      }
      if (levelInterrupts) {
        for (let interruptNumber = 0; interruptNumber < 32; interruptNumber++) {
          if (levelInterrupts & (1 << interruptNumber)) {
            this.exceptionEntry(16 + interruptNumber);
            return;
          }
        }
      }
    }
    this.interruptsUpdated = false;
  }

  readSpecialRegister(sysm: number) {
    switch (sysm) {
      case SYSM_APSR:
        return this.APSR;

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
        console.warn('MRS with unimplemented SYSm value: ', sysm);
        return 0;
    }
  }

  writeSpecialRegister(sysm: number, value: number) {
    switch (sysm) {
      case SYSM_APSR:
        this.APSR = value;
        break;

      case SYSM_IPSR:
        this.IPSR = value;
        break;

      case SYSM_PRIMASK:
        this.PM = !!(value & 1);
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
        console.warn('MSR with unimplemented SYSm value: ', sysm);
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

  executeInstruction() {
    if (this.interruptsUpdated) {
      this.checkForInterrupts();
    }
    // ARM Thumb instruction encoding - 16 bits / 2 bytes
    const opcode = this.readUint16(this.PC);
    const opcode2 = this.readUint16(this.PC + 2);
    const opcodePC = this.PC;
    this.PC += 2;
    // ADCS
    if (opcode >> 6 === 0b0100000101) {
      const Rm = (opcode >> 3) & 0x7;
      const Rdn = opcode & 0x7;
      const leftValue = this.registers[Rdn];
      const rightValue = this.registers[Rm];
      const result = leftValue + rightValue + (this.C ? 1 : 0);
      this.registers[Rdn] = result;
      this.N = !!(result & 0x80000000);
      this.Z = (result & 0xffffffff) === 0;
      this.C = result >= 0xffffffff;
      this.V =
        ((leftValue | 0) >= 0 && (rightValue | 0) >= 0 && (result | 0) < 0) ||
        ((leftValue | 0) <= 0 && (rightValue | 0) <= 0 && (result | 0) > 0);
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
      const leftValue = this.registers[Rn];
      const result = leftValue + imm3;
      this.registers[Rd] = result;
      this.N = !!(result & 0x80000000);
      this.Z = (result & 0xffffffff) === 0;
      this.C = result >= 0xffffffff;
      this.V = (leftValue | 0) > 0 && imm3 < 0x80 && (result | 0) < 0;
    }
    // ADDS (Encoding T2)
    else if (opcode >> 11 === 0b00110) {
      const imm8 = opcode & 0xff;
      const Rdn = (opcode >> 8) & 0x7;
      const leftValue = this.registers[Rdn];
      const result = leftValue + imm8;
      this.registers[Rdn] = result;
      this.N = !!(result & 0x80000000);
      this.Z = (result & 0xffffffff) === 0;
      this.C = result >= 0xffffffff;
      this.V = (leftValue | 0) > 0 && imm8 < 0x80 && (result | 0) < 0;
    }
    // ADDS (register)
    else if (opcode >> 9 === 0b0001100) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      const leftValue = this.registers[Rn];
      const rightValue = this.registers[Rm];
      const result = leftValue + rightValue;
      this.registers[Rd] = result;
      this.N = !!(result & 0x80000000);
      this.Z = (result & 0xffffffff) === 0;
      this.C = result >= 0xffffffff;
      this.V = (leftValue | 0) > 0 && rightValue < 0x80 && (result | 0) < 0;
    }
    // ADD (register)
    else if (opcode >> 8 === 0b01000100) {
      const regSP = 13;
      const regPC = 15;
      const Rm = (opcode >> 3) & 0xf;
      const Rdn = ((opcode & 0x80) >> 4) | (opcode & 0x7);
      const leftValue = Rdn === regPC ? this.PC + 2 : this.registers[Rdn];
      const rightValue = this.registers[Rm];
      const result = leftValue + rightValue;
      this.registers[Rdn] = Rdn === regPC ? result & ~0x1 : result;
      if (Rdn !== regSP && Rdn !== regPC) {
        this.N = !!(result & 0x80000000);
        this.Z = (result & 0xffffffff) === 0;
        this.C = result >= 0xffffffff;
        this.V = (leftValue | 0) > 0 && rightValue < 0x80 && (result | 0) < 0;
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
      const result = imm5 ? this.registers[Rm] >> imm5 : 0;
      this.registers[Rd] = result;
      this.N = !!(result & 0x80000000);
      this.Z = (result & 0xffffffff) === 0;
      this.C = !!((input >>> (imm5 ? imm5 - 1 : 31)) & 0x1);
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
      }
    }
    // B
    else if (opcode >> 11 === 0b11100) {
      let imm11 = (opcode & 0x7ff) << 1;
      if (imm11 & (1 << 11)) {
        imm11 = (imm11 & 0x7ff) - 0x800;
      }
      this.PC += imm11 + 2;
    }
    // BICS
    else if (opcode >> 6 === 0b0100001110) {
      let Rm = (opcode >> 3) & 0x7;
      let Rdn = opcode & 0x7;
      const result = (this.registers[Rdn] &= ~this.registers[Rm]);
      this.N = !!(result & 0x80000000);
      this.Z = result === 0;
    }
    // BKPT
    else if (opcode >> 8 === 0b10111110) {
      const imm8 = opcode & 0xff;
      this.onBreak(imm8);
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
    }
    // BLX
    else if (opcode >> 7 === 0b010001111 && (opcode & 0x7) === 0) {
      const Rm = (opcode >> 3) & 0xf;
      this.LR = this.PC | 0x1;
      this.PC = this.registers[Rm] & ~1;
    }
    // BX
    else if (opcode >> 7 === 0b010001110 && (opcode & 0x7) === 0) {
      const Rm = (opcode >> 3) & 0xf;
      this.BXWritePC(this.registers[Rm]);
    }
    // CMP immediate
    else if (opcode >> 11 === 0b00101) {
      const Rn = (opcode >> 8) & 0x7;
      const imm8 = opcode & 0xff;
      const value = this.registers[Rn] | 0;
      const result = (value - imm8) | 0;
      this.N = value < imm8;
      this.Z = value === imm8;
      this.C = value >= imm8;
      this.V = value < 0 && imm8 > 0 && result > 0;
    }
    // CMP (register)
    else if (opcode >> 6 === 0b0100001010) {
      const Rm = (opcode >> 3) & 0x7;
      const Rn = opcode & 0x7;
      const leftValue = this.registers[Rn] | 0;
      const rightValue = this.registers[Rm] | 0;
      const result = (leftValue - rightValue) | 0;
      this.N = leftValue < rightValue;
      this.Z = leftValue === rightValue;
      this.C = leftValue >= rightValue;
      this.V =
        (leftValue > 0 && rightValue < 0 && result < 0) ||
        (leftValue < 0 && rightValue > 0 && result > 0);
      // CMP (register) encoding T2
    } else if (opcode >> 8 === 0b01000101) {
      const Rm = (opcode >> 3) & 0xf;
      const Rn = ((opcode >> 4) & 0x8) | (opcode & 0x7);
      const leftValue = this.registers[Rn] | 0;
      const rightValue = this.registers[Rm] | 0;
      const result = (leftValue - rightValue) | 0;
      this.N = leftValue < rightValue;
      this.Z = leftValue === rightValue;
      this.C = leftValue >= rightValue;
      this.V =
        (leftValue > 0 && rightValue < 0 && result < 0) ||
        (leftValue < 0 && rightValue > 0 && result > 0);
    }
    // CPSID i
    else if (opcode === 0xb672) {
      this.PM = true;
    }
    // CPSIE i
    else if (opcode === 0xb662) {
      this.PM = false;
    }
    // DMB SY
    else if (opcode === 0xf3bf && (opcode2 & 0xfff0) === 0x8f50) {
      this.PC += 2;
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
    // LDMIA
    else if (opcode >> 11 === 0b11001) {
      const Rn = (opcode >> 8) & 0x7;
      const registers = opcode & 0xff;
      let address = this.registers[Rn];
      for (let i = 0; i < 8; i++) {
        if (registers & (1 << i)) {
          this.registers[i] = this.readUint32(address);
          address += 4;
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
      this.registers[Rt] = this.readUint32(addr);
    }
    // LDR (sp + immediate)
    else if (opcode >> 11 === 0b10011) {
      const Rt = (opcode >> 8) & 0x7;
      const imm8 = opcode & 0xff;
      const addr = this.SP + (imm8 << 2);
      this.registers[Rt] = this.readUint32(addr);
    }
    // LDR (literal)
    else if (opcode >> 11 === 0b01001) {
      const imm8 = (opcode & 0xff) << 2;
      const Rt = (opcode >> 8) & 7;
      const nextPC = this.PC + 2;
      const addr = (nextPC & 0xfffffffc) + imm8;
      this.registers[Rt] = this.readUint32(addr);
    }
    // LDR (register)
    else if (opcode >> 9 === 0b0101100) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
      this.registers[Rt] = this.readUint32(addr);
    }
    // LDRB (immediate)
    else if (opcode >> 11 === 0b01111) {
      const imm5 = (opcode >> 6) & 0x1f;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rn] + imm5;
      this.registers[Rt] = this.readUint8(addr);
    }
    // LDRB (register)
    else if (opcode >> 9 === 0b0101110) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
      this.registers[Rt] = this.readUint8(addr);
    }
    // LDRH (immediate)
    else if (opcode >> 11 === 0b10001) {
      const imm5 = (opcode >> 6) & 0x1f;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rn] + (imm5 << 1);
      this.registers[Rt] = this.readUint16(addr);
    }
    // LDRH (register)
    else if (opcode >> 9 === 0b0101101) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
      this.registers[Rt] = this.readUint16(addr);
    }
    // LDRSB
    else if (opcode >> 9 === 0b0101011) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
      this.registers[Rt] = signExtend8(this.readUint8(addr));
    }
    // LDRSH
    else if (opcode >> 9 === 0b0101111) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
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
      const result = input << shiftCount;
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
      const result = input >>> shiftAmount;
      this.registers[Rdn] = result;
      this.N = !!(result & 0x80000000);
      this.Z = result === 0;
      this.C = !!((input >>> (shiftAmount - 1)) & 0x1);
    }
    // MOV
    else if (opcode >> 8 === 0b01000110) {
      const Rm = (opcode >> 3) & 0xf;
      const Rd = ((opcode >> 4) & 0x8) | (opcode & 0x7);
      this.registers[Rd] = Rm === pcRegister ? this.PC + 2 : this.registers[Rm];
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
    }
    // MSR
    else if (opcode >> 4 === 0b111100111000 && opcode2 >> 8 == 0b10001000) {
      const SYSm = opcode2 & 0xff;
      const Rn = opcode & 0xf;
      this.writeSpecialRegister(SYSm, this.registers[Rn]);
      this.PC += 2;
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
        }
      }
      if (P) {
        this.BXWritePC(this.readUint32(address));
        address += 4;
      }
      this.SP = address;
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
      let Rm = (opcode >> 3) & 0x7;
      let Rd = opcode & 0x7;
      const input = this.registers[Rm];
      this.registers[Rd] =
        ((input & 0xff) << 24) |
        (((input >> 8) & 0xff) << 16) |
        (((input >> 16) & 0xff) << 8) |
        ((input >> 24) & 0xff);
    }
    // NEGS / RSBS
    else if (opcode >> 6 === 0b0100001001) {
      let Rn = (opcode >> 3) & 0x7;
      let Rd = opcode & 0x7;
      const value = this.registers[Rn] | 0;
      this.registers[Rd] = -value;
      this.N = value > 0;
      this.Z = value === 0;
      this.C = value === 0;
      this.V = value === 0x7fffffff;
    }
    // SBCS (Encoding T2)
    else if (opcode >> 6 === 0b0100000110) {
      let Rm = (opcode >> 3) & 0x7;
      let Rdn = opcode & 0x7;
      const operand1 = this.registers[Rdn];
      const operand2 = this.registers[Rm] + (this.C ? 0 : 1);
      const result = (operand1 - operand2) | 0;
      this.registers[Rdn] = result;
      this.N = operand1 < operand2;
      this.Z = operand1 === operand2;
      this.C = operand1 >= operand2;
      this.V = (operand1 | 0) < 0 && operand2 > 0 && result > 0;
    }
    // SEV
    else if (opcode === 0b1011111101000000) {
      console.log('SEV');
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
      this.writeUint32(address, this.registers[Rt]);
    }
    // STR (sp + immediate)
    else if (opcode >> 11 === 0b10010) {
      const Rt = (opcode >> 8) & 0x7;
      const imm8 = opcode & 0xff;
      const address = this.SP + (imm8 << 2);
      this.writeUint32(address, this.registers[Rt]);
    }
    // STR (register)
    else if (opcode >> 9 === 0b0101000) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addres = this.registers[Rm] + this.registers[Rn];
      this.writeUint32(addres, this.registers[Rt]);
    }
    // STRB (immediate)
    else if (opcode >> 11 === 0b01110) {
      const imm5 = (opcode >> 6) & 0x1f;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rn] + imm5;
      this.writeUint8(address, this.registers[Rt]);
    }
    // STRB (register)
    else if (opcode >> 9 === 0b0101010) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addres = this.registers[Rm] + this.registers[Rn];
      this.writeUint8(addres, this.registers[Rt]);
    }
    // STRH (immediate)
    else if (opcode >> 11 === 0b10000) {
      const imm5 = ((opcode >> 6) & 0x1f) << 1;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rn] + imm5;
      this.writeUint16(address, this.registers[Rt]);
    }
    // STRH (register)
    else if (opcode >> 9 === 0b0101001) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addres = this.registers[Rm] + this.registers[Rn];
      this.writeUint16(addres, this.registers[Rt]);
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
      const value = this.registers[Rn];
      const result = (value - imm3) | 0;
      this.registers[Rd] = result;
      this.N = value < imm3;
      this.Z = value === imm3;
      this.C = value >= imm3;
      this.V = (value | 0) < 0 && imm3 > 0 && result > 0;
    }
    // SUBS (Encoding T2)
    else if (opcode >> 11 === 0b00111) {
      const imm8 = opcode & 0xff;
      const Rdn = (opcode >> 8) & 0x7;
      const value = this.registers[Rdn];
      const result = (value - imm8) | 0;
      this.registers[Rdn] = result;
      this.N = value < imm8;
      this.Z = value === imm8;
      this.C = value >= imm8;
      this.V = (value | 0) < 0 && imm8 > 0 && result > 0;
    }
    // SUBS (register)
    else if (opcode >> 9 === 0b0001101) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      const leftValue = this.registers[Rn];
      const rightValue = this.registers[Rm];
      const result = (leftValue - rightValue) | 0;
      this.registers[Rd] = result;
      this.N = leftValue < rightValue;
      this.Z = leftValue === rightValue;
      this.C = leftValue >= rightValue;
      this.V = (leftValue | 0) < 0 && rightValue > 0 && result > 0;
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
      this.onBreak(imm8);
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
      // do nothing for now. Wait for event!
    } else {
      console.log(`Warning: Instruction at ${opcodePC.toString(16)} is not implemented yet!`);
      console.log(`Opcode: 0x${opcode.toString(16)} (0x${opcode2.toString(16)})`);
    }
  }

  execute() {
    this.executeTimer = null;
    this.stopped = false;
    for (let i = 0; i < 1000 && !this.stopped; i++) {
      this.executeInstruction();
    }
    if (!this.stopped) {
      this.executeTimer = setTimeout(() => this.execute(), 0);
    }
  }

  stop() {
    this.stopped = true;
    if (this.executeTimer != null) {
      clearTimeout(this.executeTimer);
      this.executeTimer = null;
    }
  }
}
