import { BasePeripheral, Peripheral } from './peripheral.js';

/* See RP2040 datasheet sect 4.10.13 */
const SSI_CTRLR0 = 0x00000000;
const SSI_CTRLR1 = 0x00000004;
const SSI_SSIENR = 0x00000008;
const SSI_MWCR = 0x0000000c;
const SSI_SER = 0x00000010;
const SSI_BAUDR = 0x00000014;
const SSI_TXFTLR = 0x00000018;
const SSI_RXFTLR = 0x0000001c;
const SSI_TXFLR = 0x00000020;
const SSI_RXFLR = 0x00000024;
const SSI_SR = 0x00000028;
const SSI_SR_TFNF_BITS = 0x00000002;
const SSI_SR_TFE_BITS = 0x00000004;
const SSI_SR_RFNE_BITS = 0x00000008;
const SSI_IMR = 0x0000002c;
const SSI_ISR = 0x00000030;
const SSI_RISR = 0x00000034;
const SSI_TXOICR = 0x00000038;
const SSI_RXOICR = 0x0000003c;
const SSI_RXUICR = 0x00000040;
const SSI_MSTICR = 0x00000044;
const SSI_ICR = 0x00000048;
const SSI_DMACR = 0x0000004c;
const SSI_DMATDLR = 0x00000050;
const SSI_DMARDLR = 0x00000054;
/** Identification register */
const SSI_IDR = 0x00000058;
const SSI_VERSION_ID = 0x0000005c;
const SSI_DR0 = 0x00000060;
const SSI_RX_SAMPLE_DLY = 0x000000f0;
const SSI_SPI_CTRL_R0 = 0x000000f4;
const SSI_TXD_DRIVE_EDGE = 0x000000f8;

const CMD_READ_STATUS = 0x05;

export class RPSSI extends BasePeripheral implements Peripheral {
  private dr0 = 0;
  private txflr = 0;
  private rxflr = 0;
  private baudr = 0;
  private crtlr0 = 0;
  private crtlr1 = 0;
  private ssienr = 0;
  private spictlr0 = 0;
  private rxsampldly = 0;
  private txddriveedge = 0;

  readUint32(offset: number) {
    switch (offset) {
      case SSI_TXFLR:
        return this.txflr;
      case SSI_RXFLR:
        return this.rxflr;
      case SSI_CTRLR0:
        return this.crtlr0; /*  & 0x017FFFFF = b23,b25..31 reserved */
      case SSI_CTRLR1:
        return this.crtlr1;
      case SSI_SSIENR:
        return this.ssienr;
      case SSI_BAUDR:
        return this.baudr;
      case SSI_SR:
        return SSI_SR_TFE_BITS | SSI_SR_RFNE_BITS | SSI_SR_TFNF_BITS;
      case SSI_IDR:
        return 0x51535049;
      case SSI_VERSION_ID:
        return 0x3430312a;
      case SSI_RX_SAMPLE_DLY:
        return this.rxsampldly;
      case SSI_TXD_DRIVE_EDGE:
        return this.txddriveedge;
      case SSI_SPI_CTRL_R0:
        return this.spictlr0; /* b6,7,10,19..23 reserved */
      case SSI_DR0:
        return this.dr0;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case SSI_TXFLR:
        this.txflr = value;
        return;
      case SSI_RXFLR:
        this.rxflr = value;
        return;
      case SSI_CTRLR0:
        this.crtlr0 = value; /*  & 0x017FFFFF = b23,b25..31 reserved */
        return;
      case SSI_CTRLR1:
        this.crtlr1 = value;
        return;
      case SSI_SSIENR:
        this.ssienr = value;
        return;
      case SSI_BAUDR:
        this.baudr = value;
        return;
      case SSI_RX_SAMPLE_DLY:
        this.rxsampldly = value & 0xff;
        return;
      case SSI_TXD_DRIVE_EDGE:
        this.txddriveedge = value & 0xff;
        return;
      case SSI_SPI_CTRL_R0:
        this.spictlr0 = value;
        return;
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
