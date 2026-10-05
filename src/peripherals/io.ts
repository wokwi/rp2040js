import { GPIOPin } from '../gpio-pin.js';
import { RP2040 } from '../rp2040.js';
import { BasePeripheral, Peripheral } from './peripheral.js';

const GPIO_CTRL_LAST = 0x0ec;
const INTR0 = 0xf0;
const PROC0_INTE0 = 0x100;
const PROC0_INTF0 = 0x110;
const PROC0_INTS0 = 0x120;
const PROC0_INTS3 = 0x12c;

/**
 * The CTRL/STATUS/INTR register block shared by IO_BANK0 (rp2040.gpio, the default, 30
 * general-purpose pins) and IO_QSPI (rp2040.qspi, 6 dedicated QSPI pins - same register layout,
 * just a different, smaller pin list) - pass `pins` explicitly for the latter.
 */
export class RPIO extends BasePeripheral implements Peripheral {
  readonly pins: GPIOPin[];

  constructor(rp2040: RP2040, name: string, pins?: GPIOPin[]) {
    super(rp2040, name);
    this.pins = pins ?? rp2040.gpio;
  }

  getPinFromOffset(offset: number) {
    const gpioIndex = offset >>> 3;
    return {
      gpio: this.pins[gpioIndex],
      isCtrl: !!(offset & 0x4),
    };
  }

  readUint32(offset: number) {
    if (offset <= GPIO_CTRL_LAST) {
      const { gpio, isCtrl } = this.getPinFromOffset(offset);
      return isCtrl ? gpio.ctrl : gpio.status;
    }
    if (offset >= INTR0 && offset <= PROC0_INTS3) {
      const startIndex = (offset & 0xf) * 2;
      const register = offset & ~0xf;
      const { pins } = this;
      let result = 0;
      for (let index = 7; index >= 0; index--) {
        const pin = pins[index + startIndex];
        if (!pin) {
          continue;
        }
        result <<= 4;
        switch (register) {
          case INTR0:
            result |= pin.irqStatus;
            break;
          case PROC0_INTE0:
            result |= pin.irqEnableMask;
            break;
          case PROC0_INTF0:
            result |= pin.irqForceMask;
            break;
          case PROC0_INTS0:
            result |= (pin.irqStatus & pin.irqEnableMask) | pin.irqForceMask;
            break;
        }
      }
      return result;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    if (offset <= GPIO_CTRL_LAST) {
      const { gpio, isCtrl } = this.getPinFromOffset(offset);
      if (isCtrl) {
        gpio.ctrl = value;
        gpio.checkForUpdates();
      }
      return;
    }
    if (offset >= INTR0 && offset <= PROC0_INTS3) {
      const startIndex = (offset & 0xf) * 2;
      const register = offset & ~0xf;
      const { pins } = this;
      for (let index = 0; index < 8; index++) {
        const pin = pins[index + startIndex];
        if (!pin) {
          continue;
        }
        const pinValue = (value >> (index * 4)) & 0xf;
        const pinRawWriteValue = (this.rawWriteValue >> (index * 4)) & 0xf;
        switch (register) {
          case INTR0:
            pin.updateIRQValue(pinRawWriteValue);
            break;
          case PROC0_INTE0:
            if (pin.irqEnableMask !== pinValue) {
              pin.irqEnableMask = pinValue;
              this.rp2040.updateIOInterrupt();
            }
            break;
          case PROC0_INTF0:
            if (pin.irqForceMask !== pinValue) {
              pin.irqForceMask = pinValue;
              this.rp2040.updateIOInterrupt();
            }
            break;
        }
      }
      return;
    }

    super.writeUint32(offset, value);
  }
}
