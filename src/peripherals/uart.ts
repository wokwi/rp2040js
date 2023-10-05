import { RP2040 } from '../rp2040.js';
import { FIFO } from '../utils/fifo.js';
import { DREQChannel } from './dma.js';
import { BasePeripheral, Peripheral } from './peripheral.js';

const UARTDR = 0x0;
const UARTFR = 0x18;
const UARTIBRD = 0x24;
const UARTFBRD = 0x28;
const UARTLCR_H = 0x2c;
const UARTCR = 0x30;
const UARTIMSC = 0x38;
const UARTIRIS = 0x3c;
const UARTIMIS = 0x40;
const UARTICR = 0x44;
const UARTPERIPHID0 = 0xfe0;
const UARTPERIPHID1 = 0xfe4;
const UARTPERIPHID2 = 0xfe8;
const UARTPERIPHID3 = 0xfec;
const UARTPCELLID0 = 0xff0;
const UARTPCELLID1 = 0xff4;
const UARTPCELLID2 = 0xff8;
const UARTPCELLID3 = 0xffc;

// UARTFR bits:
const TXFE = 1 << 7;
const RXFF = 1 << 6;
const RXFE = 1 << 4;

// UARTLCR_H bits:
const FEN = 1 << 4;

// UARTCR bits:
const RXE = 1 << 9;
const TXE = 1 << 8;
const UARTEN = 1 << 0;

// Interrupt bits
const UARTTXINTR = 1 << 5;
const UARTRXINTR = 1 << 4;

export interface IUARTDMAChannels {
  rx: DREQChannel;
  tx: DREQChannel;
}

export class RPUART extends BasePeripheral implements Peripheral {
  private ctrlRegister = RXE | TXE;
  private lineCtrlRegister = 0;
  private rxFIFO = new FIFO(32);
  private interruptMask = 0;
  private interruptStatus = 0;
  private intDivisor = 0;
  private fracDivisor = 0;

  public onByte?: (value: number) => void;
  public onBaudRateChange?: (baudRate: number) => void;

  constructor(
    rp2040: RP2040,
    name: string,
    readonly irq: number,
    readonly dreq: IUARTDMAChannels,
  ) {
    super(rp2040, name);
  }

  get enabled() {
    return !!(this.ctrlRegister & UARTEN);
  }

  get txEnabled() {
    return !!(this.ctrlRegister & TXE);
  }

  get rxEnabled() {
    return !!(this.ctrlRegister & RXE);
  }

  get fifosEnabled() {
    return !!(this.lineCtrlRegister & FEN);
  }

  /**
   * Number of bits per UART character
   */
  get wordLength() {
    switch ((this.lineCtrlRegister >>> 5) & 0x3) {
      case 0b00:
        return 5;
      case 0b01:
        return 6;
      case 0b10:
        return 7;
      case 0b11:
        return 8;
    }
  }

  get baudDivider() {
    return this.intDivisor + this.fracDivisor / 64;
  }

  get baudRate() {
    return Math.round(this.rp2040.clkPeri / (this.baudDivider * 16));
  }

  get flags() {
    return (this.rxFIFO.full ? RXFF : 0) | (this.rxFIFO.empty ? RXFE : 0) | TXFE;
  }

  checkInterrupts() {
    // TODO We should actually implement a proper FIFO for TX
    this.interruptStatus |= UARTTXINTR;
    this.rp2040.setInterrupt(this.irq, !!(this.interruptStatus & this.interruptMask));
  }

  feedByte(value: number) {
    this.rxFIFO.push(value);
    // TODO check if the FIFO has reached the threshold level
    this.interruptStatus |= UARTRXINTR;
    this.checkInterrupts();
  }

  readUint32(offset: number) {
    switch (offset) {
      case UARTDR: {
        const value = this.rxFIFO.pull();
        if (!this.rxFIFO.empty) {
          this.interruptStatus |= UARTRXINTR;
        } else {
          this.interruptStatus &= ~UARTRXINTR;
        }
        this.checkInterrupts();
        return value;
      }
      case UARTFR:
        return this.flags;
      case UARTIBRD:
        return this.intDivisor;
      case UARTFBRD:
        return this.fracDivisor;
      case UARTLCR_H:
        return this.lineCtrlRegister;
      case UARTCR:
        return this.ctrlRegister;
      case UARTIMSC:
        return this.interruptMask;
      case UARTIRIS:
        return this.interruptStatus;
      case UARTIMIS:
        return this.interruptStatus & this.interruptMask;
      case UARTPERIPHID0:
        return 0x11;
      case UARTPERIPHID1:
        return 0x10;
      case UARTPERIPHID2:
        return 0x34;
      case UARTPERIPHID3:
        return 0x00;
      case UARTPCELLID0:
        return 0x0d;
      case UARTPCELLID1:
        return 0xf0;
      case UARTPCELLID2:
        return 0x05;
      case UARTPCELLID3:
        return 0xb1;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case UARTDR:
        this.onByte?.(value & 0xff);
        break;

      case UARTIBRD:
        this.intDivisor = value & 0xffff;
        this.onBaudRateChange?.(this.baudRate);
        break;

      case UARTFBRD:
        this.fracDivisor = value & 0x3f;
        this.onBaudRateChange?.(this.baudRate);
        break;

      case UARTLCR_H:
        this.lineCtrlRegister = value;
        break;

      case UARTCR:
        this.ctrlRegister = value;
        if (this.enabled) {
          this.rp2040.dma.setDREQ(this.dreq.tx);
        } else {
          this.rp2040.dma.clearDREQ(this.dreq.tx);
        }
        break;

      case UARTIMSC:
        this.interruptMask = value & 0x7ff;
        this.checkInterrupts();
        break;

      case UARTICR:
        this.interruptStatus &= ~this.rawWriteValue;
        this.checkInterrupts();
        break;

      default:
        super.writeUint32(offset, value);
    }
  }
}
