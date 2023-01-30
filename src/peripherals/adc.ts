import { IRQ } from '../irq';
import { RP2040 } from '../rp2040';
import { FIFO } from '../utils/fifo';
import { DREQChannel } from './dma';
import { BasePeripheral, Peripheral } from './peripheral';

const CS = 0x00; // ADC Control and Status
const RESULT = 0x04; // Result of most recent ADC conversion
const FCS = 0x08; // FIFO control and status
const FIFO_REG = 0x0c; // Conversion result FIFO
const DIV = 0x10; // Clock divider.0x14 INTR Raw Interrupts
const INTR = 0x14; // Raw Interrupts
const INTE = 0x18; // Interrupt Enable
const INTF = 0x1c; // Interrupt Force
const INTS = 0x20; // Interrupt status after masking & forcing

// CS bits
const CS_RROBIN_MASK = 0x1f;
const CS_RROBIN_SHIFT = 16;
const CS_AINSEL_MASK = 0x7;
const CS_AINSEL_SHIFT = 12;
const CS_ERR_STICKY = 1 << 10;
const CS_ERR = 1 << 9;
const CS_READY = 1 << 8;
const CS_START_MANY = 1 << 3;
const CS_START_ONE = 1 << 2;
const CS_TS_EN = 1 << 1;
const CS_EN = 1 << 0;
const CS_WRITE_MASK =
  (CS_RROBIN_MASK << CS_RROBIN_SHIFT) |
  (CS_AINSEL_MASK << CS_AINSEL_SHIFT) |
  CS_START_MANY |
  CS_START_ONE |
  CS_TS_EN |
  CS_EN;

// FCS bits
const FCS_THRES_MASK = 0xf;
const FCS_THRESH_SHIFT = 24;
const FCS_LEVEL_MASK = 0xf;
const FCS_LEVEL_SHIFT = 16;
const FCS_OVER = 1 << 11;
const FCS_UNDER = 1 << 10;
const FCS_FULL = 1 << 9;
const FCS_EMPTY = 1 << 8;
const FCS_DREQ_EN = 1 << 3;
const FCS_ERR = 1 << 2;
const FCS_SHIFT = 1 << 1;
const FCS_EN = 1 << 0;
const FCS_WRITE_MASK =
  (FCS_THRES_MASK << FCS_THRESH_SHIFT) | FCS_DREQ_EN | FCS_ERR | FCS_SHIFT | FCS_EN;

// FIFO_REG bits
const FIFO_ERR = 1 << 15;

// DIV bits
const DIV_INT_MASK = 0xffff;
const DIV_INT_SHIFT = 8;
const DIV_FRAC_MASK = 0xff;
const DIV_FRAC_SHIFT = 0;

// Interrupt bits
const FIFO_INT = 1 << 0;

export class RPADC extends BasePeripheral implements Peripheral {
  /* Number of ADC channels */
  readonly numChannels = 5;

  /** ADC resolution (in bits) */
  readonly resolution = 12;

  /** Time to read a single sample, in microseconds */
  readonly sampleTime = 2;

  /**
   * ADC Channel values. Channels 0...3 are connected to GPIO 26...29, and channel 4 is connected to the built-in
   * temperature sensor: T=27-(ADC_voltage-0.706)/0.001721.
   *
   * Changing the values will change the ADC reading, unless you override onADCRead() with a custom implementation.
   */
  readonly channelValues = [0, 0, 0, 0, 0];

  /**
   * Invoked whenever the emulated code performs an ADC read.
   *
   * The default implementation reads the result from the `channelValues` array, and then calls
   * completeADCRead() after `sampleTime` milliseconds.
   *
   * If you override the default implementation, make sure to call `completeADCRead()` after
   * `sampleTime` milliseconds (or else the ADC read will never complete).
   */
  onADCRead: (channel: number) => void = (channel) => {
    // Default implementation
    this.rp2040.clock.createTimer(this.sampleTime, () =>
      this.completeADCRead(this.channelValues[channel], false)
    );
  };

  readonly fifo = new FIFO(4);
  readonly dreq = DREQChannel.DREQ_ADC;

  // Registers
  cs = 0;
  fcs = 0;
  clockDiv = 0;
  intEnable = 0;
  intForce = 0;
  result = 0;

  // Status
  busy = false;
  err = false;

  get temperatueEnable() {
    return this.cs & CS_TS_EN;
  }

  get enabled() {
    return this.cs & CS_EN;
  }

  get divider() {
    return (
      1 +
      ((this.clockDiv >> DIV_INT_SHIFT) & DIV_INT_MASK) +
      ((this.clockDiv >> DIV_FRAC_SHIFT) & DIV_FRAC_MASK) / 256
    );
  }

  get intRaw() {
    const thres = (this.fcs >> FCS_THRESH_SHIFT) & FCS_THRES_MASK;
    return this.fifo.itemCount >= thres ? FIFO_INT : 0;
  }

  get intStatus() {
    return (this.intRaw & this.intEnable) | this.intForce;
  }

  private get activeChannel() {
    return (this.cs >> CS_AINSEL_SHIFT) & CS_AINSEL_MASK;
  }

  private set activeChannel(channel: number) {
    this.cs &= ~(CS_AINSEL_MASK << CS_AINSEL_SHIFT);
    this.cs |= (channel & CS_AINSEL_SHIFT) << CS_AINSEL_SHIFT;
  }

  constructor(rp2040: RP2040, name: string) {
    super(rp2040, name);
  }

  checkInterrupts() {
    this.rp2040.setInterrupt(IRQ.ADC_FIFO, !!this.intStatus);
  }

  startADCRead() {
    this.busy = true;
    this.onADCRead(this.activeChannel);
  }

  private updateDMA() {
    if (this.fcs & FCS_DREQ_EN) {
      const thres = (this.fcs >> FCS_THRESH_SHIFT) & FCS_THRES_MASK;
      if (this.fifo.itemCount >= thres) {
        this.rp2040.dma.setDREQ(this.dreq);
      } else {
        this.rp2040.dma.clearDREQ(this.dreq);
      }
    }
  }

  completeADCRead(value: number, error: boolean) {
    this.busy = false;
    this.result = value;
    if (error) {
      this.cs |= CS_ERR_STICKY | CS_ERR;
    } else {
      this.cs &= ~CS_ERR;
    }

    // FIFO
    if (this.fcs & FCS_EN) {
      if (this.fifo.full) {
        this.fcs |= FCS_OVER;
      } else {
        value &= 0xfff; // 12 bits
        if (this.fcs & FCS_SHIFT) {
          value >>= 4;
        }
        if (error && this.fcs & FCS_ERR) {
          value |= FIFO_ERR;
        }
        this.fifo.push(value);
        this.updateDMA();
        this.checkInterrupts();
      }
    }

    // Round-robin
    const round = (this.cs >> CS_RROBIN_SHIFT) & CS_RROBIN_MASK;
    if (round) {
      let channel = this.activeChannel + 1;
      while (!(round & (1 << channel))) {
        channel = (channel + 1) % this.numChannels;
      }
      this.activeChannel = channel;
    }

    // Multi-shot conversions
    if (this.cs & CS_START_MANY) {
      const clockMHZ = 48;
      const sampleTicks = clockMHZ * this.sampleTime;
      if (this.divider > sampleTicks) {
        // clock runs at 48MHz, subtract 2uS
        const micros = (this.divider - sampleTicks) / clockMHZ;
        this.rp2040.clock.createTimer(micros, () => {
          if (this.cs & CS_START_MANY) {
            this.startADCRead();
          }
        });
      } else {
        this.startADCRead();
      }
    }
  }

  readUint32(offset: number) {
    switch (offset) {
      case CS:
        return this.cs | (this.err ? CS_ERR : 0) | (this.busy ? 0 : CS_READY);
      case RESULT:
        return this.result;
      case FCS:
        return (
          this.fcs |
          ((this.fifo.itemCount & FCS_LEVEL_MASK) << FCS_LEVEL_SHIFT) |
          (this.fifo.full ? FCS_FULL : 0) |
          (this.fifo.empty ? FCS_EMPTY : 0)
        );
      case FIFO_REG:
        if (this.fifo.empty) {
          this.fcs |= FCS_UNDER;
          return 0;
        } else {
          const value = this.fifo.pull();
          this.updateDMA();
          return value;
        }
      case DIV:
        return this.clockDiv;
      case INTR:
        return this.intRaw;
      case INTE:
        return this.intEnable;
      case INTF:
        return this.intForce;
      case INTS:
        return this.intStatus;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case CS:
        this.fcs &= ~(value & CS_ERR_STICKY); // Write-clear bits
        this.cs = (this.cs & ~CS_WRITE_MASK) | (value & CS_WRITE_MASK);
        if (value & CS_EN && !this.busy && (value & CS_START_ONE || value & CS_START_MANY)) {
          this.startADCRead();
        }
        break;
      case FCS:
        this.fcs &= ~(value & (FCS_OVER | FCS_UNDER)); // Write-clear bits
        this.fcs = (this.fcs & ~FCS_WRITE_MASK) | (value & FCS_WRITE_MASK);
        this.checkInterrupts();
        break;
      case DIV:
        this.clockDiv = value;
        break;
      case INTE:
        this.intEnable = value & FIFO_INT;
        this.checkInterrupts();
        break;
      case INTF:
        this.intForce = value & FIFO_INT;
        this.checkInterrupts();
        break;
      default:
        super.writeUint32(offset, value);
    }
  }
}
