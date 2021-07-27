import { RP2040 } from '../rp2040';
import { BasePeripheral, Peripheral } from './peripheral';

const CLK_REF_SELECTED = 0x38;
const CLK_SYS_SELECTED = 0x44;

export class RPClocks extends BasePeripheral implements Peripheral {
  constructor(rp2040: RP2040, name: string) {
    super(rp2040, name);
  }

  readUint32(offset: number) {
    switch (offset) {
      case CLK_REF_SELECTED:
        return 1;

      case CLK_SYS_SELECTED:
        return 1;
    }
    return super.readUint32(offset);
  }
}
