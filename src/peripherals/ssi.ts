import { BasePeripheral, Peripheral } from './peripheral.js';

const SSI_TXFLR = 0x00000020;
const SSI_RXFLR = 0x00000024;
const SSI_SR = 0x00000028;
const SSI_DR0 = 0x00000060;
const SSI_SR_TFNF_BITS = 0x00000002;
const SSI_SR_TFE_BITS = 0x00000004;
const SSI_SR_RFNE_BITS = 0x00000008;

const CMD_READ_STATUS = 0x05;

export class RPSSI extends BasePeripheral implements Peripheral {
  private dr0 = 0;

  readUint32(offset: number) {
    switch (offset) {
      case SSI_TXFLR:
        return 0;
      case SSI_RXFLR:
        return 0;
      case SSI_SR:
        return SSI_SR_TFE_BITS | SSI_SR_RFNE_BITS | SSI_SR_TFNF_BITS;
      case SSI_DR0:
        return this.dr0;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case SSI_DR0:
        if (value === CMD_READ_STATUS) {
          this.dr0 = 0; // tell stage2 that we completed a write
        }
        return;
      default:
        super.writeUint32(offset, value);
    }
  }
}
