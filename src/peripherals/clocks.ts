import { RP2040 } from '../rp2040';
import { BasePeripheral, Peripheral } from './peripheral';

const CLK_REF_CTRL = 0x30;
const CLK_REF_SELECTED = 0x38;
const CLK_SYS_CTRL = 0x3c;
const CLK_SYS_SELECTED = 0x44;

export class RPClocks extends BasePeripheral implements Peripheral {
  refCtrl = 0;
  sysCtrl = 0;
  constructor(rp2040: RP2040, name: string) {
    super(rp2040, name);
  }

  readUint32(offset: number) {
    switch (offset) {
      case CLK_REF_CTRL:
        return this.refCtrl;
      case CLK_REF_SELECTED:
        return 1 << (this.refCtrl & 0x03);
      case CLK_SYS_CTRL:
        return this.sysCtrl;
      case CLK_SYS_SELECTED:
        return 1 << (this.sysCtrl & 0x01);
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number): void {
    switch (offset) {
      case CLK_REF_CTRL:
        this.refCtrl = value;
        break;
      case CLK_SYS_CTRL:
        this.sysCtrl = value;
        break;
      default:
        super.writeUint32(offset, value);
        break;
    }
  }
}
