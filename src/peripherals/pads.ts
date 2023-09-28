import { RP2040 } from '../rp2040.js';
import { BasePeripheral, Peripheral } from './peripheral.js';

const VOLTAGE_SELECT = 0;
const GPIO_FIRST = 0x4;
const GPIO_LAST = 0x78;

const QSPI_FIRST = 0x4;
const QSPI_LAST = 0x18;

export type IIOBank = 'qspi' | 'bank0';

export class RPPADS extends BasePeripheral implements Peripheral {
  voltageSelect = 0;

  private readonly firstPadRegister = this.bank === 'qspi' ? QSPI_FIRST : GPIO_FIRST;
  private readonly lastPadRegister = this.bank === 'qspi' ? QSPI_LAST : GPIO_LAST;

  constructor(
    rp2040: RP2040,
    name: string,
    readonly bank: IIOBank,
  ) {
    super(rp2040, name);
  }

  getPinFromOffset(offset: number) {
    const gpioIndex = (offset - this.firstPadRegister) >>> 2;
    if (this.bank === 'qspi') {
      return this.rp2040.qspi[gpioIndex];
    } else {
      return this.rp2040.gpio[gpioIndex];
    }
  }

  readUint32(offset: number) {
    if (offset >= this.firstPadRegister && offset <= this.lastPadRegister) {
      const gpio = this.getPinFromOffset(offset);
      return gpio.padValue;
    }
    switch (offset) {
      case VOLTAGE_SELECT:
        return this.voltageSelect;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    if (offset >= this.firstPadRegister && offset <= this.lastPadRegister) {
      const gpio = this.getPinFromOffset(offset);
      const oldInputEnable = gpio.inputEnable;
      gpio.padValue = value;
      gpio.checkForUpdates();
      if (oldInputEnable !== gpio.inputEnable) {
        gpio.refreshInput();
      }
      return;
    }
    switch (offset) {
      case VOLTAGE_SELECT:
        this.voltageSelect = value & 1;
        break;
      default:
        super.writeUint32(offset, value);
    }
  }
}
