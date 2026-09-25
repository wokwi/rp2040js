import { describe, expect, it } from 'vitest';
import { MockClock } from '../clock/mock-clock.js';
import { RP2040 } from '../rp2040.js';

const CLOCKS_BASE = 0x40008000;
const CLK_REF_CTRL = CLOCKS_BASE + 0x30;
const CLK_REF_DIV = CLOCKS_BASE + 0x34;
const CLK_SYS_CTRL = CLOCKS_BASE + 0x3c;
const CLK_SYS_DIV = CLOCKS_BASE + 0x40;

const PLL_SYS_BASE = 0x40028000;
const PLL_CS = PLL_SYS_BASE + 0x00;
const PLL_FBDIV_INT = PLL_SYS_BASE + 0x08;
const PLL_PRIM = PLL_SYS_BASE + 0x0c;

const MHz = 1_000_000;

/** CLK_REF_CTRL.SRC = xosc_clksrc */
const CLK_REF_SRC_XOSC = 0x2;
/** CLK_SYS_CTRL.SRC = clksrc_clk_sys_aux */
const CLK_SYS_SRC_AUX = 0x1;
/** CLK_SYS_CTRL.AUXSRC = clksrc_pll_sys */
const CLK_SYS_AUXSRC_PLL_SYS = 0x0 << 5;
/** CLK_SYS_CTRL.AUXSRC = xosc_clksrc */
const CLK_SYS_AUXSRC_XOSC = 0x3 << 5;
/** CLK_SYS_CTRL.AUXSRC = clksrc_gpin0 */
const CLK_SYS_AUXSRC_GPIN0 = 0x4 << 5;

/**
 * Configures PLL_SYS the way pico-sdk's `pll_init()` does, then points clk_ref at the
 * crystal and clk_sys at PLL_SYS, as `clocks_init()` / `set_sys_clock_khz()` do.
 */
function setSysClock(rp2040: RP2040, { refdiv = 1, fbdiv = 125, postdiv1 = 6, postdiv2 = 2 } = {}) {
  rp2040.writeUint32(PLL_CS, refdiv);
  rp2040.writeUint32(PLL_FBDIV_INT, fbdiv);
  rp2040.writeUint32(PLL_PRIM, (postdiv1 << 16) | (postdiv2 << 12));
  rp2040.writeUint32(CLK_REF_CTRL, CLK_REF_SRC_XOSC);
  rp2040.writeUint32(CLK_SYS_CTRL, CLK_SYS_SRC_AUX | CLK_SYS_AUXSRC_PLL_SYS);
}

describe('RPClocks', () => {
  it('should default to 125 MHz until the firmware configures the clock tree', () => {
    const rp2040 = new RP2040(new MockClock());
    expect(rp2040.clkSys).toEqual(125 * MHz);
  });

  it('should compute a 200 MHz clk_sys, the arduino-pico default for the Pico', () => {
    // VCO = 12 MHz / 1 * 100 = 1200 MHz, / (6 * 1) = 200 MHz
    const rp2040 = new RP2040(new MockClock());
    setSysClock(rp2040, { fbdiv: 100, postdiv1: 6, postdiv2: 1 });
    expect(rp2040.clkSys).toEqual(200 * MHz);
  });

  it('should apply the CLK_SYS_DIV integer and fractional divisor', () => {
    const rp2040 = new RP2040(new MockClock());
    setSysClock(rp2040);
    rp2040.writeUint32(CLK_SYS_DIV, (2 << 8) | 128); // divide by 2.5
    expect(rp2040.clkSys).toEqual(50 * MHz);
  });

  it('should treat a CLK_SYS_DIV integer part of 0 as a divide by 2^16', () => {
    const rp2040 = new RP2040(new MockClock());
    setSysClock(rp2040);
    rp2040.writeUint32(CLK_SYS_DIV, 0);
    expect(rp2040.clkSys).toEqual((125 * MHz) / 0x10000);
  });

  it('should run clk_sys straight off the crystal when AUXSRC selects xosc', () => {
    const rp2040 = new RP2040(new MockClock());
    rp2040.writeUint32(CLK_SYS_CTRL, CLK_SYS_SRC_AUX | CLK_SYS_AUXSRC_XOSC);
    expect(rp2040.clkSys).toEqual(12 * MHz);
  });

  it('should follow clk_ref when CLK_SYS_CTRL.SRC selects it', () => {
    const rp2040 = new RP2040(new MockClock());
    rp2040.writeUint32(CLK_REF_CTRL, CLK_REF_SRC_XOSC);
    rp2040.writeUint32(CLK_REF_DIV, 2 << 8);
    rp2040.writeUint32(CLK_SYS_CTRL, 0); // SRC = clk_ref
    expect(rp2040.clkSys).toEqual(6 * MHz);
  });

  it('should keep the last known good frequency for clock sources we do not model', () => {
    const rp2040 = new RP2040(new MockClock());
    setSysClock(rp2040, { fbdiv: 100, postdiv1: 6, postdiv2: 1 });
    rp2040.writeUint32(CLK_SYS_CTRL, CLK_SYS_SRC_AUX | CLK_SYS_AUXSRC_GPIN0);
    expect(rp2040.clkSys).toEqual(200 * MHz);
  });

  it('should notify clock listeners when clk_sys changes', () => {
    const rp2040 = new RP2040(new MockClock());
    const calls: Array<[number, number]> = [];
    rp2040.addClockListener((clkSys, oldClkSys) => calls.push([clkSys, oldClkSys]));
    setSysClock(rp2040, { fbdiv: 100, postdiv1: 6, postdiv2: 1 });
    expect(calls.at(-1)).toEqual([200 * MHz, 12 * MHz]);
  });

  it('should not notify clock listeners when clk_sys is unchanged', () => {
    const rp2040 = new RP2040(new MockClock());
    setSysClock(rp2040, { fbdiv: 100, postdiv1: 6, postdiv2: 1 });
    let calls = 0;
    rp2040.addClockListener(() => calls++);
    // Re-selecting the same source leaves clk_sys at 200 MHz
    rp2040.writeUint32(CLK_SYS_CTRL, CLK_SYS_SRC_AUX | CLK_SYS_AUXSRC_PLL_SYS);
    expect(calls).toEqual(0);
  });

  it('should stop notifying a clock listener after it unsubscribes', () => {
    const rp2040 = new RP2040(new MockClock());
    let calls = 0;
    const unsubscribe = rp2040.addClockListener(() => calls++);
    unsubscribe();
    setSysClock(rp2040, { fbdiv: 100, postdiv1: 6, postdiv2: 1 });
    expect(calls).toEqual(0);
  });

  it('should retune systick and the PWM timers when clk_sys changes', () => {
    const rp2040 = new RP2040(new MockClock());
    setSysClock(rp2040, { fbdiv: 100, postdiv1: 6, postdiv2: 1 });
    expect(rp2040.ppb.systickTimer.frequency).toEqual(200 * MHz);
    expect(rp2040.pwm.channels[0].timer.frequency).toEqual(200 * MHz);
  });
});
