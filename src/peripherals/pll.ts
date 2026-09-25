import { BasePeripheral, Peripheral } from './peripheral.js';

// PLL register offsets
const PLL_CS = 0x00; // Control and Status
const PLL_PWR = 0x04; // Power control
const PLL_FBDIV_INT = 0x08; // Feedback divisor
const PLL_PRIM = 0x0c; // Primary post dividers

// PLL_CS bits
const PLL_CS_LOCK = 1 << 31;
const PLL_CS_BYPASS = 1 << 8;
const PLL_CS_REFDIV_MASK = 0x3f;

// PLL_FBDIV_INT bits
const PLL_FBDIV_INT_MASK = 0xfff;

// PLL_PRIM bits
const PLL_PRIM_POSTDIV1_SHIFT = 16;
const PLL_PRIM_POSTDIV2_SHIFT = 12;
const PLL_PRIM_POSTDIV_MASK = 0x7;

/**
 * RP2040 PLL peripheral.
 *
 * Always reports locked (we have no startup delay to model), and computes its output
 * frequency from the divider registers:
 *
 *   f_out = (f_ref / REFDIV * FBDIV) / (POSTDIV1 * POSTDIV2)
 *
 * The frequency is what makes `RP2040.clkSys` follow `set_sys_clock_khz()` and friends.
 */
export class RPPLL extends BasePeripheral implements Peripheral {
  private cs = 0x1; // REFDIV = 1
  private pwr = 0x2d; // VCO and post dividers powered down
  private fbdivInt = 0;
  private prim = 0x77000; // POSTDIV1 = 7, POSTDIV2 = 7

  get refdiv() {
    return this.cs & PLL_CS_REFDIV_MASK;
  }

  get fbdiv() {
    return this.fbdivInt & PLL_FBDIV_INT_MASK;
  }

  get postdiv1() {
    return (this.prim >>> PLL_PRIM_POSTDIV1_SHIFT) & PLL_PRIM_POSTDIV_MASK;
  }

  get postdiv2() {
    return (this.prim >>> PLL_PRIM_POSTDIV2_SHIFT) & PLL_PRIM_POSTDIV_MASK;
  }

  /** PLL output frequency, in Hz, derived from the current register values. */
  get frequency() {
    const refFreq = this.rp2040.xoscFreq / (this.refdiv || 1);
    if (this.cs & PLL_CS_BYPASS) {
      return refFreq;
    }
    const postdiv = (this.postdiv1 || 1) * (this.postdiv2 || 1);
    return (refFreq * this.fbdiv) / postdiv;
  }

  readUint32(offset: number) {
    switch (offset) {
      case PLL_CS:
        return this.cs | PLL_CS_LOCK;
      case PLL_PWR:
        return this.pwr;
      case PLL_FBDIV_INT:
        return this.fbdivInt;
      case PLL_PRIM:
        return this.prim;
      default:
        return super.readUint32(offset);
    }
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case PLL_CS:
        this.cs = value;
        break;
      case PLL_PWR:
        this.pwr = value;
        break;
      case PLL_FBDIV_INT:
        this.fbdivInt = value;
        break;
      case PLL_PRIM:
        this.prim = value;
        break;
      default:
        super.writeUint32(offset, value);
        return;
    }
    this.rp2040.updateClocks();
  }
}
