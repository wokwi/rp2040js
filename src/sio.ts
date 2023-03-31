import { RP2040 } from './rp2040';
import { Core } from './core';
import { RPSIOCore } from './sio-core';

const CPUID = 0x000;

// GPIO
const GPIO_IN = 0x004; // Input value for GPIO pins
const GPIO_HI_IN = 0x008; // Input value for QSPI pins
const GPIO_OUT = 0x010; // GPIO output value
const GPIO_OUT_SET = 0x014; // GPIO output value set
const GPIO_OUT_CLR = 0x018; // GPIO output value clear
const GPIO_OUT_XOR = 0x01c; // GPIO output value XOR
const GPIO_OE = 0x020; // GPIO output enable
const GPIO_OE_SET = 0x024; // GPIO output enable set
const GPIO_OE_CLR = 0x028; // GPIO output enable clear
const GPIO_OE_XOR = 0x02c; // GPIO output enable XOR
const GPIO_HI_OUT = 0x030; // QSPI output value
const GPIO_HI_OUT_SET = 0x034; // QSPI output value set
const GPIO_HI_OUT_CLR = 0x038; // QSPI output value clear
const GPIO_HI_OUT_XOR = 0x03c; // QSPI output value XOR
const GPIO_HI_OE = 0x040; // QSPI output enable
const GPIO_HI_OE_SET = 0x044; // QSPI output enable set
const GPIO_HI_OE_CLR = 0x048; // QSPI output enable clear
const GPIO_HI_OE_XOR = 0x04c; // QSPI output enable XOR

const GPIO_MASK = 0x3fffffff;

//SPINLOCK
const SPINLOCK_ST = 0x5c;
const SPINLOCK0 = 0x100;
const SPINLOCK31 = 0x17c;

export class RPSIO {
  gpioValue = 0;
  gpioOutputEnable = 0;
  qspiGpioValue = 0;
  qspiGpioOutputEnable = 0;
  spinLock = 0;
  readonly core0;
  readonly core1;

  constructor(private readonly rp2040: RP2040) {
    const cores = RPSIOCore.create2Cores(rp2040);
    this.core0 = cores[0];
    this.core1 = cores[1];
  }

  readUint32(offset: number, core: Core) {
    if (offset >= SPINLOCK0 && offset <= SPINLOCK31) {
      const bitIndexMask = 1 << ((offset - SPINLOCK0) / 4);
      if (this.spinLock & bitIndexMask) {
        return 0;
      } else {
        this.spinLock |= bitIndexMask;
        return bitIndexMask;
      }
    }
    switch (offset) {
      case GPIO_IN:
        return this.rp2040.gpioValues;
      case GPIO_HI_IN: {
        const { qspi } = this.rp2040;
        let result = 0;
        for (let qspiIndex = 0; qspiIndex < qspi.length; qspiIndex++) {
          if (qspi[qspiIndex].inputValue) {
            result |= 1 << qspiIndex;
          }
        }
        return result;
      }
      case GPIO_OUT:
        return this.gpioValue;
      case GPIO_OE:
        return this.gpioOutputEnable;
      case GPIO_HI_OUT:
        return this.qspiGpioValue;
      case GPIO_HI_OE:
        return this.qspiGpioOutputEnable;
      case GPIO_OUT_SET:
      case GPIO_OUT_CLR:
      case GPIO_OUT_XOR:
      case GPIO_OE_SET:
      case GPIO_OE_CLR:
      case GPIO_OE_XOR:
      case GPIO_HI_OUT_SET:
      case GPIO_HI_OUT_CLR:
      case GPIO_HI_OUT_XOR:
      case GPIO_HI_OE_SET:
      case GPIO_HI_OE_CLR:
      case GPIO_HI_OE_XOR:
        return 0; // TODO verify with silicone
      case CPUID:
        switch (core) {
          case Core.Core0:
            return 0;
          case Core.Core1:
            return 1;
        }
        break;
      case SPINLOCK_ST:
        return this.spinLock;
    }
    switch (core) {
      case Core.Core0:
        return this.core0.readUint32(offset);
      case Core.Core1:
        return this.core1.readUint32(offset);
    }
  }

  writeUint32(offset: number, value: number, core: Core) {
    if (offset >= SPINLOCK0 && offset <= SPINLOCK31) {
      const bitIndexMask = ~(1 << ((offset - SPINLOCK0) / 4));
      this.spinLock &= bitIndexMask;
      return;
    }
    const prevGpioValue = this.gpioValue;
    const prevGpioOutputEnable = this.gpioOutputEnable;
    switch (offset) {
      case GPIO_OUT:
        this.gpioValue = value & GPIO_MASK;
        break;
      case GPIO_OUT_SET:
        this.gpioValue |= value & GPIO_MASK;
        break;
      case GPIO_OUT_CLR:
        this.gpioValue &= ~value;
        break;
      case GPIO_OUT_XOR:
        this.gpioValue ^= value & GPIO_MASK;
        break;
      case GPIO_OE:
        this.gpioOutputEnable = value & GPIO_MASK;
        break;
      case GPIO_OE_SET:
        this.gpioOutputEnable |= value & GPIO_MASK;
        break;
      case GPIO_OE_CLR:
        this.gpioOutputEnable &= ~value;
        break;
      case GPIO_OE_XOR:
        this.gpioOutputEnable ^= value & GPIO_MASK;
        break;
      case GPIO_HI_OUT:
        this.qspiGpioValue = value & GPIO_MASK;
        break;
      case GPIO_HI_OUT_SET:
        this.qspiGpioValue |= value & GPIO_MASK;
        break;
      case GPIO_HI_OUT_CLR:
        this.qspiGpioValue &= ~value;
        break;
      case GPIO_HI_OUT_XOR:
        this.qspiGpioValue ^= value & GPIO_MASK;
        break;
      case GPIO_HI_OE:
        this.qspiGpioOutputEnable = value & GPIO_MASK;
        break;
      case GPIO_HI_OE_SET:
        this.qspiGpioOutputEnable |= value & GPIO_MASK;
        break;
      case GPIO_HI_OE_CLR:
        this.qspiGpioOutputEnable &= ~value;
        break;
      case GPIO_HI_OE_XOR:
        this.qspiGpioOutputEnable ^= value & GPIO_MASK;
        break;
      default:
        switch (core) {
          case Core.Core0:
            this.core0.writeUint32(offset, value);
            break;
          case Core.Core1:
            this.core1.writeUint32(offset, value);
            break;
        }
    }
    const pinsToUpdate =
      (this.gpioValue ^ prevGpioValue) | (this.gpioOutputEnable ^ prevGpioOutputEnable);
    if (pinsToUpdate) {
      const { gpio } = this.rp2040;
      for (let gpioIndex = 0; gpioIndex < gpio.length; gpioIndex++) {
        if (pinsToUpdate & (1 << gpioIndex)) {
          gpio[gpioIndex].checkForUpdates();
        }
      }
    }
  }
}
