import { IClock } from './clock/clock';
import { RealtimeClock } from './clock/realtime-clock';
import { GPIOPin } from './gpio-pin';
import { IRQ, MAX_HARDWARE_IRQ } from './irq';
import { RPADC } from './peripherals/adc';
import { RPClocks } from './peripherals/clocks';
import { RPI2C } from './peripherals/i2c';
import { RPIO } from './peripherals/io';
import { RPPADS } from './peripherals/pads';
import { Peripheral, UnimplementedPeripheral } from './peripherals/peripheral';
import { RPPIO } from './peripherals/pio';
import { RPPPB } from './peripherals/ppb';
import { RPReset } from './peripherals/reset';
import { RP2040RTC } from './peripherals/rtc';
import { RPSPI } from './peripherals/spi';
import { RPSSI } from './peripherals/ssi';
import { RP2040SysCfg } from './peripherals/syscfg';
import { RPTimer } from './peripherals/timer';
import { RPUART } from './peripherals/uart';
import { RPUSBController } from './peripherals/usb';
import { RPSIO } from './sio';
import { ConsoleLogger, Logger, LogLevel } from './utils/logging';

export const FLASH_START_ADDRESS = 0x10000000;
export const FLASH_END_ADDRESS = 0x14000000;
export const RAM_START_ADDRESS = 0x20000000;
export const DPRAM_START_ADDRESS = 0x50100000;
export const SIO_START_ADDRESS = 0xd0000000;

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

export type CPUWriteCallback = (value: number, address: number) => void;
export type CPUReadCallback = (address: number) => number;

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

const LOG_NAME = 'RP2040';

const KB = 1024;
const MB = 1024 * KB;
const MHz = 1_000_000;

export class RP2040 {
  readonly bootrom = new Uint32Array(4 * KB);
  readonly sram = new Uint8Array(264 * KB);
  readonly sramView = new DataView(this.sram.buffer);
  readonly flash = new Uint8Array(16 * MB);
  readonly flash16 = new Uint16Array(this.flash.buffer);
  readonly flashView = new DataView(this.flash.buffer);
  readonly usbDPRAM = new Uint8Array(4 * KB);
  readonly usbDPRAMView = new DataView(this.usbDPRAM.buffer);
  readonly registers = new Uint32Array(16);
  bankedSP: number = 0;
  cycles: number = 0;

  /* Clocks */
  clkSys = 125 * MHz;
  clkPeri = 125 * MHz;

  readonly ppb = new RPPPB(this, 'PPB');
  readonly sio = new RPSIO(this);

  readonly uart = [new RPUART(this, 'UART0', IRQ.UART0), new RPUART(this, 'UART1', IRQ.UART1)];
  readonly i2c = [new RPI2C(this, 'I2C0', IRQ.I2C0), new RPI2C(this, 'I2C1', IRQ.I2C1)];
  readonly spi = [new RPSPI(this, 'SPI0', IRQ.SPI0), new RPSPI(this, 'SPI1', IRQ.SPI1)];
  readonly adc = new RPADC(this, 'ADC');

  readonly gpio = [
    new GPIOPin(this, 0),
    new GPIOPin(this, 1),
    new GPIOPin(this, 2),
    new GPIOPin(this, 3),
    new GPIOPin(this, 4),
    new GPIOPin(this, 5),
    new GPIOPin(this, 6),
    new GPIOPin(this, 7),
    new GPIOPin(this, 8),
    new GPIOPin(this, 9),
    new GPIOPin(this, 10),
    new GPIOPin(this, 11),
    new GPIOPin(this, 12),
    new GPIOPin(this, 13),
    new GPIOPin(this, 14),
    new GPIOPin(this, 15),
    new GPIOPin(this, 16),
    new GPIOPin(this, 17),
    new GPIOPin(this, 18),
    new GPIOPin(this, 19),
    new GPIOPin(this, 20),
    new GPIOPin(this, 21),
    new GPIOPin(this, 22),
    new GPIOPin(this, 23),
    new GPIOPin(this, 24),
    new GPIOPin(this, 25),
    new GPIOPin(this, 26),
    new GPIOPin(this, 27),
    new GPIOPin(this, 28),
    new GPIOPin(this, 29),
  ];

  readonly qspi = [
    new GPIOPin(this, 0, 'SCLK'),
    new GPIOPin(this, 1, 'SS'),
    new GPIOPin(this, 2, 'SD0'),
    new GPIOPin(this, 3, 'SD1'),
    new GPIOPin(this, 4, 'SD2'),
    new GPIOPin(this, 5, 'SD3'),
  ];

  readonly pio = [new RPPIO(this, 'PIO0', IRQ.PIO0_IRQ0), new RPPIO(this, 'PIO1', IRQ.PIO1_IRQ0)];
  readonly usbCtrl = new RPUSBController(this, 'USB');

  private stopped = true;
  eventRegistered = false;
  waiting = false;

  public logger: Logger = new ConsoleLogger(LogLevel.Debug, true);

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
  pendingSVCall: boolean = false;
  pendingSystick: boolean = false;
  interruptsUpdated = false;
  VTOR = 0;
  SHPR2 = 0;
  SHPR3 = 0;

  private executeTimer: NodeJS.Timeout | null = null;

  readonly peripherals: { [index: number]: Peripheral } = {
    0x18000: new RPSSI(this, 'SSI'),
    0x40000: new UnimplementedPeripheral(this, 'SYSINFO_BASE'),
    0x40004: new RP2040SysCfg(this, 'SYSCFG'),
    0x40008: new RPClocks(this, 'CLOCKS_BASE'),
    0x4000c: new RPReset(this, 'RESETS_BASE'),
    0x40010: new UnimplementedPeripheral(this, 'PSM_BASE'),
    0x40014: new RPIO(this, 'IO_BANK0_BASE'),
    0x40018: new UnimplementedPeripheral(this, 'IO_QSPI_BASE'),
    0x4001c: new RPPADS(this, 'PADS_BANK0_BASE', 'bank0'),
    0x40020: new RPPADS(this, 'PADS_QSPI_BASE', 'qspi'),
    0x40024: new UnimplementedPeripheral(this, 'XOSC_BASE'),
    0x40028: new UnimplementedPeripheral(this, 'PLL_SYS_BASE'),
    0x4002c: new UnimplementedPeripheral(this, 'PLL_USB_BASE'),
    0x40030: new UnimplementedPeripheral(this, 'BUSCTRL_BASE'),
    0x40034: this.uart[0],
    0x40038: this.uart[1],
    0x4003c: this.spi[0],
    0x40040: this.spi[1],
    0x40044: this.i2c[0],
    0x40048: this.i2c[1],
    0x4004c: this.adc,
    0x40050: new UnimplementedPeripheral(this, 'PWM_BASE'),
    0x40054: new RPTimer(this, 'TIMER_BASE'),
    0x40058: new UnimplementedPeripheral(this, 'WATCHDOG_BASE'),
    0x4005c: new RP2040RTC(this, 'RTC_BASE'),
    0x40060: new UnimplementedPeripheral(this, 'ROSC_BASE'),
    0x40064: new UnimplementedPeripheral(this, 'VREG_AND_CHIP_RESET_BASE'),
    0x4006c: new UnimplementedPeripheral(this, 'TBMAN_BASE'),
    0x50110: this.usbCtrl,
    0x50200: this.pio[0],
    0x50300: this.pio[1],
  };

  // Debugging
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onBreak = (code: number) => {
    // TODO: raise HardFault exception
    // console.error('Breakpoint!', code);
    this.stopped = true;
  };

  constructor(readonly clock: IClock = new RealtimeClock()) {
    this.SP = 0xfffffffc;
    this.bankedSP = 0xfffffffc;
  }

  loadBootrom(bootromData: Uint32Array) {
    this.bootrom.set(bootromData);
    this.reset();
  }

  reset() {
    this.SP = this.bootrom[0];
    this.PC = this.bootrom[1] & 0xfffffffe;
    this.cycles = 0;
    this.flash.fill(0xff);
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
    address = address >>> 0; // round to 32-bits, unsigned
    if (address & 0x3) {
      this.logger.error(
        LOG_NAME,
        `read from address ${address.toString(16)}, which is not 32 bit aligned`
      );
    }

    const { bootrom } = this;
    if (address < bootrom.length * 4) {
      return bootrom[address / 4];
    } else if (address >= FLASH_START_ADDRESS && address < FLASH_END_ADDRESS) {
      return this.flashView.getUint32(address - FLASH_START_ADDRESS, true);
    } else if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      return this.sramView.getUint32(address - RAM_START_ADDRESS, true);
    } else if (
      address >= DPRAM_START_ADDRESS &&
      address < DPRAM_START_ADDRESS + this.usbDPRAM.length
    ) {
      return this.usbDPRAMView.getUint32(address - DPRAM_START_ADDRESS, true);
    } else if (address >>> 12 === 0xe000e) {
      return this.ppb.readUint32(address & 0xfff);
    } else if (address >= SIO_START_ADDRESS && address < SIO_START_ADDRESS + 0x10000000) {
      return this.sio.readUint32(address - SIO_START_ADDRESS);
    }

    const peripheral = this.findPeripheral(address);
    if (peripheral) {
      return peripheral.readUint32(address & 0x3fff);
    }

    this.logger.warn(LOG_NAME, `Read from invalid memory address: ${address.toString(16)}`);
    return 0xffffffff;
  }

  findPeripheral(address: number) {
    return this.peripherals[(address >>> 14) << 2];
  }

  /** We assume the address is 16-bit aligned */
  readUint16(address: number) {
    if (address >= FLASH_START_ADDRESS && address < FLASH_END_ADDRESS) {
      return this.flashView.getUint16(address - FLASH_START_ADDRESS, true);
    } else if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      return this.sramView.getUint16(address - RAM_START_ADDRESS, true);
    }

    const value = this.readUint32(address & 0xfffffffc);
    return address & 0x2 ? (value & 0xffff0000) >>> 16 : value & 0xffff;
  }

  readUint8(address: number) {
    if (address >= FLASH_START_ADDRESS && address < FLASH_END_ADDRESS) {
      return this.flash[address - FLASH_START_ADDRESS];
    } else if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      return this.sram[address - RAM_START_ADDRESS];
    }

    const value = this.readUint16(address & 0xfffffffe);
    return (address & 0x1 ? (value & 0xff00) >>> 8 : value & 0xff) >>> 0;
  }

  writeUint32(address: number, value: number) {
    address = address >>> 0;
    const { bootrom } = this;
    const peripheral = this.findPeripheral(address);
    if (peripheral) {
      const atomicType = (address & 0x3000) >> 12;
      const offset = address & 0xfff;
      peripheral.writeUint32Atomic(offset, value, atomicType);
    } else if (address < bootrom.length * 4) {
      bootrom[address / 4] = value;
    } else if (address >= FLASH_START_ADDRESS && address < FLASH_END_ADDRESS) {
      this.flashView.setUint32(address - FLASH_START_ADDRESS, value, true);
    } else if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      this.sramView.setUint32(address - RAM_START_ADDRESS, value, true);
    } else if (
      address >= DPRAM_START_ADDRESS &&
      address < DPRAM_START_ADDRESS + this.usbDPRAM.length
    ) {
      const offset = address - DPRAM_START_ADDRESS;
      this.usbDPRAMView.setUint32(offset, value, true);
      this.usbCtrl.DPRAMUpdated(offset, value);
    } else if (address >= SIO_START_ADDRESS && address < SIO_START_ADDRESS + 0x10000000) {
      this.sio.writeUint32(address - SIO_START_ADDRESS, value);
    } else if (address >>> 12 === 0xe000e) {
      this.ppb.writeUint32(address & 0xfff, value);
    } else {
      this.logger.warn(LOG_NAME, `Write to undefined address: ${address.toString(16)}`);
    }
  }

  writeUint8(address: number, value: number) {
    if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      this.sram[address - RAM_START_ADDRESS] = value;
      return;
    }

    const alignedAddress = (address & 0xfffffffc) >>> 0;
    const offset = address & 0x3;
    const peripheral = this.findPeripheral(address);
    if (peripheral) {
      const atomicType = (alignedAddress & 0x3000) >> 12;
      const offset = alignedAddress & 0xfff;
      peripheral.writeUint32Atomic(
        offset,
        (value & 0xff) | ((value & 0xff) << 8) | ((value & 0xff) << 16) | ((value & 0xff) << 24),
        atomicType
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

    if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      this.sramView.setUint16(address - RAM_START_ADDRESS, value, true);
      return;
    }

    const alignedAddress = (address & 0xfffffffc) >>> 0;
    const offset = address & 0x3;
    const peripheral = this.findPeripheral(address);
    if (peripheral) {
      const atomicType = (alignedAddress & 0x3000) >> 12;
      const offset = alignedAddress & 0xfff;
      peripheral.writeUint32Atomic(offset, (value & 0xffff) | ((value & 0xffff) << 16), atomicType);
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

  get svCallPriority() {
    return this.SHPR2 >>> 30;
  }

  get systickPriority() {
    return this.SHPR3 >>> 30;
  }

  get gpioValues() {
    const { gpio } = this;
    let result = 0;
    for (let gpioIndex = 0; gpioIndex < gpio.length; gpioIndex++) {
      if (gpio[gpioIndex].inputValue) {
        result |= 1 << gpioIndex;
      }
    }
    return result;
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
        return (this.readUint32(this.SHPR3) >> 22) & 0x3;
      case EXC_SYSTICK:
        return this.readUint32(this.SHPR3) >>> 30;
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
    const currentPriority = Math.min(
      this.exceptionPriority(this.IPSR),
      this.PM ? 0 : LOWEST_PRIORITY
    );
    const interruptSet = this.pendingInterrupts & this.enabledInterrupts;
    const { svCallPriority, systickPriority } = this;
    for (let priority = 0; priority < currentPriority; priority++) {
      const levelInterrupts = interruptSet & this.interruptPriorities[priority];
      if (this.pendingSVCall && priority === svCallPriority) {
        this.pendingSVCall = false;
        this.exceptionEntry(EXC_SVCALL);
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

  updateIOInterrupt() {
    let interruptValue = false;
    for (const pin of this.gpio) {
      if (pin.irqValue) {
        interruptValue = true;
      }
    }
    this.setInterrupt(IRQ.IO_BANK0, interruptValue);
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

  executeInstruction() {
    if (this.interruptsUpdated) {
      if (this.checkForInterrupts()) {
        this.waiting = false;
      }
    }
    // ARM Thumb instruction encoding - 16 bits / 2 bytes
    const opcodePC = this.PC & ~1; //ensure no LSB set PC are executed
    const opcode = this.readUint16(opcodePC);
    const wideInstruction = opcode >> 12 === 0b1111 || opcode >> 13 === 0b11101;
    const opcode2 = wideInstruction ? this.readUint16(opcodePC + 2) : 0;
    this.PC += 2;
    this.cycles++;
    // ADCS
    if (opcode >> 6 === 0b0100000101) {
      const Rm = (opcode >> 3) & 0x7;
      const Rdn = opcode & 0x7;
      this.registers[Rdn] = this.addUpdateFlags(
        this.registers[Rm],
        this.registers[Rdn] + (this.C ? 1 : 0)
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
        this.cycles++;
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
      const result = imm5 ? input >> imm5 : (input & 0x80000000) >> 31;
      this.registers[Rd] = result;
      this.N = !!(result & 0x80000000);
      this.Z = (result & 0xffffffff) === 0;
      if (imm5) {
        this.C = input & (1 << (imm5 - 1)) ? true : false;
      }
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
      if (shiftN) {
        this.C = input & (1 << (shiftN - 1)) ? true : false;
      }
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
        this.cycles++;
      }
    }
    // B
    else if (opcode >> 11 === 0b11100) {
      let imm11 = (opcode & 0x7ff) << 1;
      if (imm11 & (1 << 11)) {
        imm11 = (imm11 & 0x7ff) - 0x800;
      }
      this.PC += imm11 + 2;
      this.cycles++;
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
      this.cycles += 2;
    }
    // BLX
    else if (opcode >> 7 === 0b010001111 && (opcode & 0x7) === 0) {
      const Rm = (opcode >> 3) & 0xf;
      this.LR = this.PC | 0x1;
      this.PC = this.registers[Rm] & ~1;
      this.cycles++;
    }
    // BX
    else if (opcode >> 7 === 0b010001110 && (opcode & 0x7) === 0) {
      const Rm = (opcode >> 3) & 0xf;
      this.BXWritePC(this.registers[Rm]);
      this.cycles++;
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
      this.cycles += 2;
    }
    // DSB SY
    else if (opcode === 0xf3bf && (opcode2 & 0xfff0) === 0x8f40) {
      this.PC += 2;
      this.cycles += 2;
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
      this.cycles += 2;
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
          this.cycles++;
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
      if (this.slowIO(addr)) {
        this.cycles++;
      }
      this.registers[Rt] = this.readUint32(addr);
    }
    // LDRB (immediate)
    else if (opcode >> 11 === 0b01111) {
      const imm5 = (opcode >> 6) & 0x1f;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rn] + imm5;
      if (this.slowIO(addr)) {
        this.cycles++;
      }
      this.registers[Rt] = this.readUint8(addr);
    }
    // LDRB (register)
    else if (opcode >> 9 === 0b0101110) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(addr)) {
        this.cycles++;
      }
      this.registers[Rt] = this.readUint8(addr);
    }
    // LDRH (immediate)
    else if (opcode >> 11 === 0b10001) {
      const imm5 = (opcode >> 6) & 0x1f;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rn] + (imm5 << 1);
      if (this.slowIO(addr)) {
        this.cycles++;
      }
      this.registers[Rt] = this.readUint16(addr);
    }
    // LDRH (register)
    else if (opcode >> 9 === 0b0101101) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(addr)) {
        this.cycles++;
      }
      this.registers[Rt] = this.readUint16(addr);
    }
    // LDRSB
    else if (opcode >> 9 === 0b0101011) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(addr)) {
        this.cycles++;
      }
      this.registers[Rt] = signExtend8(this.readUint8(addr));
    }
    // LDRSH
    else if (opcode >> 9 === 0b0101111) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const addr = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(addr)) {
        this.cycles++;
      }
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
        this.cycles++;
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
      this.cycles += 2;
    }
    // MSR
    else if (opcode >> 4 === 0b111100111000 && opcode2 >> 8 == 0b10001000) {
      const SYSm = opcode2 & 0xff;
      const Rn = opcode & 0xf;
      this.writeSpecialRegister(SYSm, this.registers[Rn]);
      this.PC += 2;
      this.cycles += 2;
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
          this.cycles++;
        }
      }
      if (P) {
        this.SP = address + 4;
        this.BXWritePC(this.readUint32(address));
        this.cycles += 2;
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
          this.cycles++;
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
        this.registers[Rm] + (1 - (this.C ? 1 : 0))
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
          this.cycles++;
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
      if (this.slowIO(address)) {
        this.cycles++;
      }
      this.writeUint32(address, this.registers[Rt]);
    }
    // STR (sp + immediate)
    else if (opcode >> 11 === 0b10010) {
      const Rt = (opcode >> 8) & 0x7;
      const imm8 = opcode & 0xff;
      const address = this.SP + (imm8 << 2);
      if (this.slowIO(address)) {
        this.cycles++;
      }
      this.writeUint32(address, this.registers[Rt]);
    }
    // STR (register)
    else if (opcode >> 9 === 0b0101000) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(address)) {
        this.cycles++;
      }
      this.writeUint32(address, this.registers[Rt]);
    }
    // STRB (immediate)
    else if (opcode >> 11 === 0b01110) {
      const imm5 = (opcode >> 6) & 0x1f;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rn] + imm5;
      if (this.slowIO(address)) {
        this.cycles++;
      }
      this.writeUint8(address, this.registers[Rt]);
    }
    // STRB (register)
    else if (opcode >> 9 === 0b0101010) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(address)) {
        this.cycles++;
      }
      this.writeUint8(address, this.registers[Rt]);
    }
    // STRH (immediate)
    else if (opcode >> 11 === 0b10000) {
      const imm5 = ((opcode >> 6) & 0x1f) << 1;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rn] + imm5;
      if (this.slowIO(address)) {
        this.cycles++;
      }
      this.writeUint16(address, this.registers[Rt]);
    }
    // STRH (register)
    else if (opcode >> 9 === 0b0101001) {
      const Rm = (opcode >> 6) & 0x7;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(address)) {
        this.cycles++;
      }
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
      this.onBreak(imm8);
    }
    // UDF (Encoding T2)
    else if (opcode >> 4 === 0b111101111111 && opcode2 >> 12 === 0b1010) {
      const imm4 = opcode & 0xf;
      const imm12 = opcode2 & 0xfff;
      this.breakRewind = 4;
      this.onBreak((imm4 << 12) | imm12);
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
      this.cycles++;
      if (this.eventRegistered) {
        this.eventRegistered = false;
      } else {
        this.waiting = true;
      }
    }
    // WFI
    else if (opcode === 0b1011111100110000) {
      this.cycles++;
      this.waiting = true;
    }
    // YIELD
    else if (opcode === 0b1011111100010000) {
      // do nothing for now. Wait for event!
      this.logger.info(LOG_NAME, 'Yield');
    } else {
      this.logger.warn(
        LOG_NAME,
        `Warning: Instruction at ${opcodePC.toString(16)} is not implemented yet!`
      );
      this.logger.warn(LOG_NAME, `Opcode: 0x${opcode.toString(16)} (0x${opcode2.toString(16)})`);
    }
  }

  slowIO(addr: number) {
    addr = addr >>> 0;
    return addr < SIO_START_ADDRESS || addr > SIO_START_ADDRESS + 0x10000000;
  }

  execute() {
    this.clock.resume();
    this.executeTimer = null;
    this.stopped = false;
    for (let i = 0; i < 100000 && !this.stopped && !this.waiting; i++) {
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
    this.clock.pause();
  }

  get executing() {
    return !this.stopped;
  }
}
