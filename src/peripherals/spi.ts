import { RP2040 } from '../rp2040';
import { FIFO } from '../utils/fifo';
import { BasePeripheral, Peripheral } from './peripheral';

const SSPCR0 = 0x000; // Control register 0, SSPCR0 on page 3-4
const SSPCR1 = 0x004; // Control register 1, SSPCR1 on page 3-5
const SSPDR = 0x008; // Data register, SSPDR on page 3-6
const SSPSR = 0x00c; // Status register, SSPSR on page 3-7
const SSPCPSR = 0x010; // Clock prescale register, SSPCPSR on page 3-8
const SSPIMSC = 0x014; // Interrupt mask set or clear register, SSPIMSC on page 3-9
const SSPRIS = 0x018; // Raw interrupt status register, SSPRIS on page 3-10
const SSPMIS = 0x01c; // Masked interrupt status register, SSPMIS on page 3-11
const SSPICR = 0x020; // Interrupt clear register, SSPICR on page 3-11
const SSPDMACR = 0x024; // DMA control register, SSPDMACR on page 3-12
const SSPPERIPHID0 = 0xfe0; // Peripheral identification registers, SSPPeriphID0-3 on page 3-13
const SSPPERIPHID1 = 0xfe4; // Peripheral identification registers, SSPPeriphID0-3 on page 3-13
const SSPPERIPHID2 = 0xfe8; // Peripheral identification registers, SSPPeriphID0-3 on page 3-13
const SSPPERIPHID3 = 0xfec; // Peripheral identification registers, SSPPeriphID0-3 on page 3-13
const SSPPCELLID0 = 0xff0; // PrimeCell identification registers, SSPPCellID0-3 on page 3-16
const SSPPCELLID1 = 0xff4; // PrimeCell identification registers, SSPPCellID0-3 on page 3-16
const SSPPCELLID2 = 0xff8; // PrimeCell identification registers, SSPPCellID0-3 on page 3-16
const SSPPCELLID3 = 0xffc; // PrimeCell identification registers, SSPPCellID0-3 on page 3-16

// SSPCR0 bits:
const SCR_MASK = 0xff;
const SCR_SHIFT = 8;
const SPH = 1 << 7;
const SPO = 1 << 6;
const FRF_MASK = 0x3;
const FRF_SHIFT = 4;
const DSS_MASK = 0xf;
const DSS_SHIFT = 0;

// SSPCR1 bits:
const SOD = 1 << 3;
const MS = 1 << 2;
const SSE = 1 << 1;
const LBM = 1 << 0;

// SSPSR bits:
const BSY = 1 << 4;
const RFF = 1 << 3;
const RNE = 1 << 2;
const TNF = 1 << 1;
const TFE = 1 << 0;

// SSPCPSR bits:
const CPSDVSR_MASK = 0xfe;
const CPSDVSR_SHIFT = 0;

// SSPDMACR bits:
const TXDMAE = 1 << 1;
const RXDMAE = 1 << 0;

// Interrupts:
const SSPTXINTR = 1 << 3;
const SSPRXINTR = 1 << 2;
const SSPRTINTR = 1 << 1;
const SSPRORINTR = 1 << 0;

export class RPSPI extends BasePeripheral implements Peripheral {
  readonly rxFIFO = new FIFO(8);
  readonly txFIFO = new FIFO(8);

  // User provided callbacks
  onTransmit: (value: number) => void = () => this.completeTransmit(0);

  private busy = false;
  private control0 = 0;
  private control1 = 0;
  private dmaControl = 0;
  private clockDivisor = 0;
  private intRaw = 0;
  private intEnable = 0;

  get intStatus() {
    return this.intRaw & this.intEnable;
  }

  get enabled() {
    return !!(this.control1 & SSE);
  }

  /** Data size in bits: 4 to 16 bits */
  get dataBits() {
    return ((this.control0 >> DSS_SHIFT) & DSS_MASK) + 1;
  }

  get masterMode() {
    return !(this.control0 & MS);
  }

  get spiMode() {
    const cpol = this.control0 & SPO;
    const cpha = this.control0 & SPH;
    return cpol ? (cpha ? 2 : 3) : cpha ? 1 : 0;
  }

  get clockFrequency() {
    if (!this.clockDivisor) {
      return 0;
    }

    const scr = (this.control0 >> SCR_SHIFT) & SCR_MASK;
    return this.rp2040.clkPeri / (this.clockDivisor * (1 + scr));
  }

  constructor(rp2040: RP2040, name: string, readonly irq: number) {
    super(rp2040, name);
  }

  private doTX() {
    if (!this.busy && !this.txFIFO.empty) {
      const value = this.txFIFO.pull();
      this.onTransmit(value);
      this.busy = true;
      this.fifosUpdated();
    }
  }

  completeTransmit(rxValue: number) {
    this.busy = false;
    if (!this.rxFIFO.full) {
      this.rxFIFO.push(rxValue);
    } else {
      this.intRaw |= SSPRORINTR;
    }
    this.fifosUpdated();
    this.doTX();
  }

  checkInterrupts() {
    this.rp2040.setInterrupt(this.irq, !!this.intStatus);
  }

  private fifosUpdated() {
    const prevStatus = this.intStatus;
    if (this.txFIFO.itemCount <= this.txFIFO.size / 2) {
      this.intRaw |= SSPTXINTR;
    } else {
      this.intRaw &= ~SSPTXINTR;
    }
    if (this.rxFIFO.itemCount >= this.rxFIFO.size / 2) {
      this.intRaw |= SSPRXINTR;
    } else {
      this.intRaw &= ~SSPRXINTR;
    }
    if (this.intStatus !== prevStatus) {
      this.checkInterrupts();
    }
  }

  readUint32(offset: number) {
    switch (offset) {
      case SSPCR0:
        return this.control0;
      case SSPCR1:
        return this.control1;
      case SSPDR:
        if (!this.rxFIFO.empty) {
          const value = this.rxFIFO.pull();
          this.fifosUpdated();
          return value;
        }
        return 0;
      case SSPSR:
        return (
          (this.busy || !this.txFIFO.empty ? BSY : 0) |
          (this.rxFIFO.full ? RFF : 0) |
          (!this.rxFIFO.empty ? RNE : 0) |
          (!this.txFIFO.full ? TNF : 0) |
          (this.txFIFO.empty ? TFE : 0)
        );
      case SSPCPSR:
        return this.clockDivisor;
      case SSPIMSC:
        return this.intEnable;
      case SSPRIS:
        return this.intRaw;
      case SSPMIS:
        return this.intStatus;
      case SSPDMACR:
        return this.dmaControl;
      case SSPPERIPHID0:
        return 0x22;
      case SSPPERIPHID1:
        return 0x10;
      case SSPPERIPHID2:
        return 0x34;
      case SSPPERIPHID3:
        return 0x00;
      case SSPPCELLID0:
        return 0x0d;
      case SSPPCELLID1:
        return 0xf0;
      case SSPPCELLID2:
        return 0x05;
      case SSPPCELLID3:
        return 0xb1;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case SSPCR0:
        this.control0 = value;
        return;
      case SSPCR1:
        this.control1 = value;
        return;
      case SSPDR:
        if (!this.txFIFO.full) {
          this.txFIFO.push(value);
          this.doTX();
          this.fifosUpdated();
        }
        return;
      case SSPCPSR:
        this.clockDivisor = value & CPSDVSR_MASK;
        return;
      case SSPIMSC:
        this.intEnable = value;
        this.checkInterrupts();
        return;
      case SSPDMACR:
        this.dmaControl = value;
        return;
      case SSPICR:
        this.intRaw &= ~(value & (SSPRTINTR | SSPRORINTR));
        this.checkInterrupts();
        return;
      default:
        super.writeUint32(offset, value);
    }
  }
}
