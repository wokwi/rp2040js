import { RP2040 } from '../rp2040';
import { FIFO } from '../utils/fifo';
import { BasePeripheral, Peripheral } from './peripheral';

const UARTDR = 0x0;
const UARTFR = 0x18;
const UARTLCR_H = 0x2c;
const UARTCR = 0x30;
const UARTIMSC = 0x38;
const UARTIRIS = 0x3c;
const UARTIMIS = 0x40;
const UARTICR = 0x44;

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
const UARTRXINTR = 1 << 4;

type UartEvents = {
  /** the MCU has written a byte to the UART */
  byteSent: (value: number) => void;
  /** readFhe MCU's read FIFO is full, and any further bytes fed to the UART will be dropped */
  readFifoFull: () => void;
  /** the MCU's read FIFO is empty */
  readFifoEmpty: () => void;
  /** the MCU has read a byte from the UART */
  byteConsumed: () => void;
};

export class RPUART extends BasePeripheral<UartEvents> implements Peripheral {
  private ctrlRegister = RXE | TXE;
  private lineCtrlRegister = 0;
  private rxFIFO = new FIFO(32);
  private interruptMask = 0;
  private interruptStatus = 0;

  /** @deprecated prefer `on("byteSent", callback)` */
  public onByte?: (value: number) => void;

  constructor(rp2040: RP2040, name: string, readonly irq: number) {
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

  get flags() {
    return (this.rxFIFO.full ? RXFF : 0) | (this.rxFIFO.empty ? RXFE : 0) | TXFE;
  }

  checkInterrupts() {
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
          this.checkInterrupts();
        }
        if (this.rxFIFO.empty) {
          this.emit('readFifoEmpty');
        }
        if (this.rxFIFO.full) {
          this.emit('readFifoFull');
        }
        this.emit('byteConsumed');
        return value;
      }
      case UARTFR:
        return this.flags;
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
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case UARTDR: {
        const byte = value & 0xff;
        this.onByte?.(byte);
        this.emit('byteSent', byte);
        break;
      }

      case UARTLCR_H:
        this.lineCtrlRegister = value;
        break;

      case UARTCR:
        this.ctrlRegister = value;
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
