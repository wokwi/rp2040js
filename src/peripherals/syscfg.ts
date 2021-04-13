import { LoggingPeripheral, Peripheral } from './peripheral';

const PROC0_NMI_MASK = 0;
const PROC1_NMI_MASK = 4;

export class RP2040SysCfg extends LoggingPeripheral implements Peripheral {
  readUint32(offset: number) {
    switch (offset) {
      case PROC0_NMI_MASK:
        return this.rp2040.interruptNMIMask;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case PROC0_NMI_MASK:
        this.rp2040.interruptNMIMask = value;
        break;

      default:
        super.writeUint32(offset, value);
    }
  }
}
