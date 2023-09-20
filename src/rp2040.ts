import { IClock } from './clock/clock';
import { RealtimeClock } from './clock/realtime-clock';
import { CortexM0Core } from './cortex-m0-core';
import { GPIOPin } from './gpio-pin';
import { IRQ } from './irq';
import { RPADC } from './peripherals/adc';
import { RPBUSCTRL } from './peripherals/busctrl';
import { RPClocks } from './peripherals/clocks';
import { DREQChannel, RPDMA } from './peripherals/dma';
import { RPI2C } from './peripherals/i2c';
import { RPIO } from './peripherals/io';
import { RPPADS } from './peripherals/pads';
import { Peripheral, UnimplementedPeripheral } from './peripherals/peripheral';
import { RPPIO } from './peripherals/pio';
import { RPPPB } from './peripherals/ppb';
import { RPPWM } from './peripherals/pwm';
import { RPReset } from './peripherals/reset';
import { RP2040RTC } from './peripherals/rtc';
import { RPSPI } from './peripherals/spi';
import { RPSSI } from './peripherals/ssi';
import { RP2040SysCfg } from './peripherals/syscfg';
import { RP2040SysInfo } from './peripherals/sysinfo';
import { RPTBMAN } from './peripherals/tbman';
import { RPTimer } from './peripherals/timer';
import { RPUART } from './peripherals/uart';
import { RPUSBController } from './peripherals/usb';
import { RPSIO } from './sio';
import { ConsoleLogger, Logger, LogLevel } from './utils/logging';

export const FLASH_START_ADDRESS = 0x10000000;
export const RAM_START_ADDRESS = 0x20000000;
export const APB_START_ADDRESS = 0x40000000;
export const DPRAM_START_ADDRESS = 0x50100000;
export const SIO_START_ADDRESS = 0xd0000000;

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

  readonly core = new CortexM0Core(this);

  /* Clocks */
  clkSys = 125 * MHz;
  clkPeri = 125 * MHz;

  readonly ppb = new RPPPB(this, 'PPB');
  readonly sio = new RPSIO(this);

  readonly uart = [
    new RPUART(this, 'UART0', IRQ.UART0, {
      rx: DREQChannel.DREQ_UART0_RX,
      tx: DREQChannel.DREQ_UART0_RX,
    }),
    new RPUART(this, 'UART1', IRQ.UART1, {
      rx: DREQChannel.DREQ_UART1_RX,
      tx: DREQChannel.DREQ_UART1_TX,
    }),
  ];
  readonly i2c = [new RPI2C(this, 'I2C0', IRQ.I2C0), new RPI2C(this, 'I2C1', IRQ.I2C1)];
  readonly pwm = new RPPWM(this, 'PWM_BASE');
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

  readonly dma = new RPDMA(this, 'DMA');
  readonly pio = [
    new RPPIO(this, 'PIO0', IRQ.PIO0_IRQ0, 0),
    new RPPIO(this, 'PIO1', IRQ.PIO1_IRQ0, 1),
  ];
  readonly usbCtrl = new RPUSBController(this, 'USB');
  readonly spi = [
    new RPSPI(this, 'SPI0', IRQ.SPI0, {
      rx: DREQChannel.DREQ_SPI0_RX,
      tx: DREQChannel.DREQ_SPI0_TX,
    }),
    new RPSPI(this, 'SPI1', IRQ.SPI1, {
      rx: DREQChannel.DREQ_SPI1_RX,
      tx: DREQChannel.DREQ_SPI1_TX,
    }),
  ];

  private stopped = true;

  public logger: Logger = new ConsoleLogger(LogLevel.Debug, true);

  private executeTimer: NodeJS.Timeout | null = null;

  readonly peripherals: { [index: number]: Peripheral } = {
    0x18000: new RPSSI(this, 'SSI'),
    0x40000: new RP2040SysInfo(this, 'SYSINFO_BASE'),
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
    0x40030: new RPBUSCTRL(this, 'BUSCTRL_BASE'),
    0x40034: this.uart[0],
    0x40038: this.uart[1],
    0x4003c: this.spi[0],
    0x40040: this.spi[1],
    0x40044: this.i2c[0],
    0x40048: this.i2c[1],
    0x4004c: this.adc,
    0x40050: this.pwm,
    0x40054: new RPTimer(this, 'TIMER_BASE'),
    0x40058: new UnimplementedPeripheral(this, 'WATCHDOG_BASE'),
    0x4005c: new RP2040RTC(this, 'RTC_BASE'),
    0x40060: new UnimplementedPeripheral(this, 'ROSC_BASE'),
    0x40064: new UnimplementedPeripheral(this, 'VREG_AND_CHIP_RESET_BASE'),
    0x4006c: new RPTBMAN(this, 'TBMAN_BASE'),
    0x50000: this.dma,
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
    this.reset();
  }

  loadBootrom(bootromData: Uint32Array) {
    this.bootrom.set(bootromData);
    this.reset();
  }

  reset() {
    this.core.reset();
    this.pwm.reset();
    this.flash.fill(0xff);
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
    } else if (
      address >= FLASH_START_ADDRESS &&
      address < FLASH_START_ADDRESS + this.flash.length
    ) {
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
    if (address >= FLASH_START_ADDRESS && address < FLASH_START_ADDRESS + this.flash.length) {
      return this.flashView.getUint16(address - FLASH_START_ADDRESS, true);
    } else if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      return this.sramView.getUint16(address - RAM_START_ADDRESS, true);
    }

    const value = this.readUint32(address & 0xfffffffc);
    return address & 0x2 ? (value & 0xffff0000) >>> 16 : value & 0xffff;
  }

  readUint8(address: number) {
    if (address >= FLASH_START_ADDRESS && address < FLASH_START_ADDRESS + this.flash.length) {
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
    } else if (
      address >= FLASH_START_ADDRESS &&
      address < FLASH_START_ADDRESS + this.flash.length
    ) {
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

  setInterrupt(irq: number, value: boolean) {
    this.core.setInterrupt(irq, value);
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

  step() {
    this.core.executeInstruction();
  }

  execute() {
    this.clock.resume();
    this.executeTimer = null;
    this.stopped = false;
    for (let i = 0; i < 100000 && !this.stopped && !this.core.waiting; i++) {
      this.core.executeInstruction();
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
