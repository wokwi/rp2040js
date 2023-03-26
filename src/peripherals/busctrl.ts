import { RP2040 } from '../rp2040';
import { BasePeripheral, Peripheral } from './peripheral';

/** Bus priority acknowledge */
const BUS_PRIORITY_ACK = 0x004;

/** Bus fabric performance counter 0 */
const PERFCTR0 = 0x008;
/** Bus fabric performance event select for PERFCTR0 */
const PERFSEL0 = 0x00c;

/** Bus fabric performance counter 1 */
const PERFCTR1 = 0x010;
/** Bus fabric performance event select for PERFCTR1 */
const PERFSEL1 = 0x014;

/** Bus fabric performance counter 2 */
const PERFCTR2 = 0x018;
/** Bus fabric performance event select for PERFCTR2 */
const PERFSEL2 = 0x01c;

/** Bus fabric performance counter 3 */
const PERFCTR3 = 0x020;
/** Bus fabric performance event select for PERFCTR3 */
const PERFSEL3 = 0x024;

export class RPBUSCTRL extends BasePeripheral implements Peripheral {
  voltageSelect = 0;
  readonly perfCtr = [0, 0, 0, 0];
  readonly perfSel = [0x1f, 0x1f, 0x1f, 0x1f];

  constructor(rp2040: RP2040, name: string) {
    super(rp2040, name);
  }

  readUint32(offset: number) {
    switch (offset) {
      case BUS_PRIORITY_ACK:
        return 1;
      case PERFCTR0:
        return this.perfCtr[0];
      case PERFSEL0:
        return this.perfSel[0];
      case PERFCTR1:
        return this.perfCtr[1];
      case PERFSEL1:
        return this.perfSel[1];
      case PERFCTR2:
        return this.perfCtr[2];
      case PERFSEL2:
        return this.perfSel[2];
      case PERFCTR3:
        return this.perfCtr[3];
      case PERFSEL3:
        return this.perfSel[3];
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case PERFCTR0:
        this.perfCtr[0] = 0;
        break;
      case PERFSEL0:
        this.perfSel[0] = value & 0x1f;
        break;
      case PERFCTR1:
        this.perfCtr[1] = 0;
        break;
      case PERFSEL1:
        this.perfSel[1] = value & 0x1f;
        break;
      case PERFCTR2:
        this.perfCtr[2] = 0;
        break;
      case PERFSEL2:
        this.perfSel[2] = value & 0x1f;
        break;
      case PERFCTR3:
        this.perfCtr[3] = 0;
        break;
      case PERFSEL3:
        this.perfSel[3] = value & 0x1f;
        break;
      default:
        super.writeUint32(offset, value);
    }
  }
}
