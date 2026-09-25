import { RP2040 } from '../rp2040.js';
import { BasePeripheral, Peripheral } from './peripheral.js';

const CLK_GPOUT0_CTRL = 0x00;
const CLK_GPOUT0_DIV = 0x04;
const CLK_GPOUT0_SELECTED = 0x8;
const CLK_GPOUT1_CTRL = 0x0c;
const CLK_GPOUT1_DIV = 0x10;
const CLK_GPOUT1_SELECTED = 0x14;
const CLK_GPOUT2_CTRL = 0x18;
const CLK_GPOUT2_DIV = 0x01c;
const CLK_GPOUT2_SELECTED = 0x20;
const CLK_GPOUT3_CTRL = 0x24;
const CLK_GPOUT3_DIV = 0x28;
const CLK_GPOUT3_SELECTED = 0x2c;
const CLK_REF_CTRL = 0x30;
const CLK_REF_DIV = 0x34;
const CLK_REF_SELECTED = 0x38;
const CLK_SYS_CTRL = 0x3c;
const CLK_SYS_DIV = 0x40;
const CLK_SYS_SELECTED = 0x44;
const CLK_PERI_CTRL = 0x48;
const CLK_PERI_DIV = 0x4c;
const CLK_PERI_SELECTED = 0x50;
const CLK_USB_CTRL = 0x54;
const CLK_USB_DIV = 0x58;
const CLK_USB_SELECTED = 0x5c;
const CLK_ADC_CTRL = 0x60;
const CLK_ADC_DIV = 0x64;
const CLK_ADC_SELECTED = 0x68;
const CLK_RTC_CTRL = 0x6c;
const CLK_RTC_DIV = 0x70;
const CLK_RTC_SELECTED = 0x74;
const CLK_SYS_RESUS_CTRL = 0x78;
const CLK_SYS_RESUS_STATUS = 0x7c;

// CLK_REF_CTRL
const CLK_REF_CTRL_SRC_MASK = 0x3;
const CLK_REF_CTRL_SRC_ROSC = 0x0;
const CLK_REF_CTRL_SRC_AUX = 0x1;
const CLK_REF_CTRL_SRC_XOSC = 0x2;
const CLK_REF_CTRL_AUXSRC_SHIFT = 5;
const CLK_REF_CTRL_AUXSRC_MASK = 0x3;
const CLK_REF_CTRL_AUXSRC_PLL_USB = 0x0;

// CLK_REF_DIV has no fractional part, only INT (bits 9:8)
const CLK_REF_DIV_INT_BITS = 0x300;

// CLK_SYS_CTRL
const CLK_SYS_CTRL_SRC_MASK = 0x1;
const CLK_SYS_CTRL_SRC_REF = 0x0;
const CLK_SYS_CTRL_AUXSRC_SHIFT = 5;
const CLK_SYS_CTRL_AUXSRC_MASK = 0x7;
const CLK_SYS_CTRL_AUXSRC_PLL_SYS = 0x0;
const CLK_SYS_CTRL_AUXSRC_PLL_USB = 0x1;
const CLK_SYS_CTRL_AUXSRC_ROSC = 0x2;
const CLK_SYS_CTRL_AUXSRC_XOSC = 0x3;

// CLK_PERI_CTRL. clk_peri has no SRC mux and no divider: it is driven straight from AUXSRC,
// which uses its own encoding (not the CLK_SYS one).
const CLK_PERI_CTRL_ENABLE = 1 << 11;
const CLK_PERI_CTRL_KILL = 1 << 10;
const CLK_PERI_CTRL_AUXSRC_SHIFT = 5;
const CLK_PERI_CTRL_AUXSRC_MASK = 0x7;
const CLK_PERI_CTRL_AUXSRC_CLK_SYS = 0x0;
const CLK_PERI_CTRL_AUXSRC_PLL_SYS = 0x1;
const CLK_PERI_CTRL_AUXSRC_PLL_USB = 0x2;
const CLK_PERI_CTRL_AUXSRC_ROSC = 0x3;
const CLK_PERI_CTRL_AUXSRC_XOSC = 0x4;

// CLK_x_DIV: 24.8 fixed point (INT bits 31:8, FRAC bits 7:0)
const CLK_DIV_INT_SHIFT = 8;
const CLK_DIV_FRAC_MASK = 0xff;

/** Decodes a CLK_x_DIV register value. INT = 0 means divide by 2^16. */
function clockDivisor(div: number) {
  const int = div >>> CLK_DIV_INT_SHIFT;
  return int ? int + (div & CLK_DIV_FRAC_MASK) / 256 : 0x10000;
}

export class RPClocks extends BasePeripheral implements Peripheral {
  gpout0Ctrl = 0;
  gpout0Div = 0x100;
  gpout1Ctrl = 0;
  gpout1Div = 0x100;
  gpout2Ctrl = 0;
  gpout2Div = 0x100;
  gpout3Ctrl = 0;
  gpout3Div = 0x100;
  refCtrl = 0;
  refDiv = 0x100;
  periCtrl = 0;
  periDiv = 0x100;
  usbCtrl = 0;
  usbDiv = 0x100;
  sysCtrl = 0;
  sysDiv = 0x100;
  adcCtrl = 0;
  adcDiv = 0x100;
  rtcCtrl = 0;
  rtcDiv = 0x100;
  constructor(rp2040: RP2040, name: string) {
    super(rp2040, name);
  }

  /** clk_ref frequency, in Hz. GPIN0/GPIN1 are not modelled and yield 0. */
  get refFreq() {
    return this.refSourceFreq / clockDivisor(this.refDiv & CLK_REF_DIV_INT_BITS);
  }

  /** clk_sys frequency, in Hz. GPIN0/GPIN1 are not modelled and yield 0. */
  get sysFreq() {
    return this.sysSourceFreq / clockDivisor(this.sysDiv);
  }

  /**
   * clk_peri frequency, in Hz. Feeds the UART and SPI baud rate generators. Returns 0 while
   * the clock generator is stopped, and for the GPIN0/GPIN1 sources we do not model.
   */
  get periFreq() {
    const { rp2040 } = this;
    if (!(this.periCtrl & CLK_PERI_CTRL_ENABLE) || this.periCtrl & CLK_PERI_CTRL_KILL) {
      return 0;
    }
    switch ((this.periCtrl >>> CLK_PERI_CTRL_AUXSRC_SHIFT) & CLK_PERI_CTRL_AUXSRC_MASK) {
      case CLK_PERI_CTRL_AUXSRC_CLK_SYS:
        return this.sysFreq;
      case CLK_PERI_CTRL_AUXSRC_PLL_SYS:
        return rp2040.pllSys.frequency;
      case CLK_PERI_CTRL_AUXSRC_PLL_USB:
        return rp2040.pllUsb.frequency;
      case CLK_PERI_CTRL_AUXSRC_ROSC:
        return rp2040.roscFreq;
      case CLK_PERI_CTRL_AUXSRC_XOSC:
        return rp2040.xoscFreq;
      default:
        return 0;
    }
  }

  private get refSourceFreq() {
    const { rp2040 } = this;
    switch (this.refCtrl & CLK_REF_CTRL_SRC_MASK) {
      case CLK_REF_CTRL_SRC_ROSC:
        return rp2040.roscFreq;
      case CLK_REF_CTRL_SRC_XOSC:
        return rp2040.xoscFreq;
      case CLK_REF_CTRL_SRC_AUX: {
        const auxsrc = (this.refCtrl >>> CLK_REF_CTRL_AUXSRC_SHIFT) & CLK_REF_CTRL_AUXSRC_MASK;
        return auxsrc === CLK_REF_CTRL_AUXSRC_PLL_USB ? rp2040.pllUsb.frequency : 0;
      }
      default:
        return 0;
    }
  }

  private get sysSourceFreq() {
    const { rp2040 } = this;
    if ((this.sysCtrl & CLK_SYS_CTRL_SRC_MASK) === CLK_SYS_CTRL_SRC_REF) {
      return this.refFreq;
    }
    switch ((this.sysCtrl >>> CLK_SYS_CTRL_AUXSRC_SHIFT) & CLK_SYS_CTRL_AUXSRC_MASK) {
      case CLK_SYS_CTRL_AUXSRC_PLL_SYS:
        return rp2040.pllSys.frequency;
      case CLK_SYS_CTRL_AUXSRC_PLL_USB:
        return rp2040.pllUsb.frequency;
      case CLK_SYS_CTRL_AUXSRC_ROSC:
        return rp2040.roscFreq;
      case CLK_SYS_CTRL_AUXSRC_XOSC:
        return rp2040.xoscFreq;
      default:
        return 0;
    }
  }

  readUint32(offset: number) {
    switch (offset) {
      case CLK_GPOUT0_CTRL:
        return this.gpout0Ctrl & 0b100110001110111100000;
      case CLK_GPOUT0_DIV:
        return this.gpout0Div;
      case CLK_GPOUT0_SELECTED:
        return 1;
      case CLK_GPOUT1_CTRL:
        return this.gpout1Ctrl & 0b100110001110111100000;
      case CLK_GPOUT1_DIV:
        return this.gpout1Div;
      case CLK_GPOUT1_SELECTED:
        return 1;
      case CLK_GPOUT2_CTRL:
        return this.gpout2Ctrl & 0b100110001110111100000;
      case CLK_GPOUT2_DIV:
        return this.gpout2Div;
      case CLK_GPOUT2_SELECTED:
        return 1;
      case CLK_GPOUT3_CTRL:
        return this.gpout3Ctrl & 0b100110001110111100000;
      case CLK_GPOUT3_DIV:
        return this.gpout3Div;
      case CLK_GPOUT3_SELECTED:
        return 1;
      case CLK_REF_CTRL:
        return this.refCtrl & 0b000001100011;
      case CLK_REF_DIV:
        return this.refDiv & 0x30; // b8..9 = int divisor. no frac divisor present
      case CLK_REF_SELECTED:
        return 1 << (this.refCtrl & 0x03);
      case CLK_SYS_CTRL:
        return this.sysCtrl & 0b000011100001;
      case CLK_SYS_DIV:
        return this.sysDiv;
      case CLK_SYS_SELECTED:
        return 1 << (this.sysCtrl & 0x01);
      case CLK_PERI_CTRL:
        return this.periCtrl & 0b110011100000;
      case CLK_PERI_DIV:
        return this.periDiv;
      case CLK_PERI_SELECTED:
        return 1;
      case CLK_USB_CTRL:
        return this.usbCtrl & 0b100110000110011100000;
      case CLK_USB_DIV:
        return this.usbDiv;
      case CLK_USB_SELECTED:
        return 1;
      case CLK_ADC_CTRL:
        return this.adcCtrl & 0b100110000110011100000;
      case CLK_ADC_DIV:
        return this.adcDiv & 0x30;
      case CLK_ADC_SELECTED:
        return 1;
      case CLK_RTC_CTRL:
        return this.rtcCtrl & 0b100110000110011100000;
      case CLK_RTC_DIV:
        return this.rtcDiv & 0x30;
      case CLK_RTC_SELECTED:
        return 1;
      case CLK_SYS_RESUS_CTRL:
        return 0xff;
      case CLK_SYS_RESUS_STATUS:
        return 0; /* clock resus not implemented */
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number): void {
    switch (offset) {
      case CLK_GPOUT0_CTRL:
        this.gpout0Ctrl = value;
        break;
      case CLK_GPOUT0_DIV:
        this.gpout0Div = value;
        break;
      case CLK_GPOUT1_CTRL:
        this.gpout1Ctrl = value;
        break;
      case CLK_GPOUT1_DIV:
        this.gpout1Div = value;
        break;
      case CLK_GPOUT2_CTRL:
        this.gpout2Ctrl = value;
        break;
      case CLK_GPOUT2_DIV:
        this.gpout2Div = value;
        break;
      case CLK_GPOUT3_CTRL:
        this.gpout3Ctrl = value;
        break;
      case CLK_GPOUT3_DIV:
        this.gpout3Div = value;
        break;
      case CLK_REF_CTRL:
        this.refCtrl = value;
        this.rp2040.updateClocks();
        break;
      case CLK_REF_DIV:
        this.refDiv = value;
        this.rp2040.updateClocks();
        break;
      case CLK_SYS_CTRL:
        this.sysCtrl = value;
        this.rp2040.updateClocks();
        break;
      case CLK_SYS_DIV:
        this.sysDiv = value;
        this.rp2040.updateClocks();
        break;
      case CLK_PERI_CTRL:
        this.periCtrl = value;
        this.rp2040.updateClocks();
        break;
      case CLK_PERI_DIV:
        this.periDiv = value;
        break;
      case CLK_USB_CTRL:
        this.usbCtrl = value;
        break;
      case CLK_USB_DIV:
        this.usbDiv = value;
        break;
      case CLK_ADC_CTRL:
        this.adcCtrl = value;
        break;
      case CLK_ADC_DIV:
        this.adcDiv = value;
        break;
      case CLK_RTC_CTRL:
        this.rtcCtrl = value;
        break;
      case CLK_RTC_DIV:
        this.rtcDiv = value;
        break;
      case CLK_SYS_RESUS_CTRL:
        return; /* clock resus not implemented */
      default:
        super.writeUint32(offset, value);
        break;
    }
  }
}
