import { BasePeripheral, Peripheral } from './peripheral';

const UARTDR = 0x0;
const UARTFR = 0x18;

export class RPUART extends BasePeripheral implements Peripheral {
  public onByte?: (value: number) => void;

  readUint32(offset: number) {
    switch (offset) {
      case UARTFR:
        return 0;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case UARTDR:
        this.onByte?.(value & 0xff);
        break;

      default:
        super.writeUint32(offset, value);
    }
  }
}
