import { BasePeripheral, Peripheral } from './peripheral.js';

const RESET = 0x0; //Reset control.
const WDSEL = 0x4; //Watchdog select.
const RESET_DONE = 0x8; //Reset Done

export class RPReset extends BasePeripheral implements Peripheral {
  private reset: number = 0;
  private wdsel: number = 0;
  private reset_done: number = 0x1ffffff;

  readUint32(offset: number) {
    switch (offset) {
      case RESET:
        return this.reset;
      case WDSEL:
        return this.wdsel;
      case RESET_DONE:
        return this.reset_done;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case RESET:
        this.reset = value & 0x1ffffff;
        break;
      case WDSEL:
        this.wdsel = value & 0x1ffffff;
        break;
      default:
        super.writeUint32(offset, value);
        break;
    }
  }
}
