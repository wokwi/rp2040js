import { BasePeripheral, Peripheral } from './peripheral';

const CHIP_ID = 0;
const PLATFORM = 0x4;
const GITREF_RP2040 = 0x40;

export class RP2040SysInfo extends BasePeripheral implements Peripheral {
  readUint32(offset: number) {
    // All the values here were verified against the silicon
    switch (offset) {
      case CHIP_ID:
        return 0x10002927;

      case PLATFORM:
        return 0x00000002;

      case GITREF_RP2040:
        return 0xe0c912e8;
    }
    return super.readUint32(offset);
  }
}
