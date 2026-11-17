import { describe, expect, it } from 'vitest';
import { RP2040 } from './rp2040.js';

const INPUT_ENABLE = 0x40;
const PULLDOWN = 0x4;
const PULLUP = 0x8;

function gpio(index = 0) {
  const rp2040 = new RP2040();
  return rp2040.gpio[index];
}

describe('GPIOPin', () => {
  it('reads low for an undriven pin with no pulls configured', () => {
    // Unchanged from before pull resolution existed - no pull configured, nothing driving it.
    const pin = gpio();
    pin.padValue = INPUT_ENABLE;
    expect(pin.inputValue).toBe(false);
  });

  it('resolves an undriven pin with a pull-up to high', () => {
    // Regression test: firmware reading an undriven, pulled-up-only pin used to always read it
    // as low, indistinguishable from a pin actively driven low - matching real hardware requires
    // resolving the pull instead.
    const pin = gpio();
    pin.padValue = INPUT_ENABLE | PULLUP;
    expect(pin.inputValue).toBe(true);
  });

  it('resolves an undriven pin with a pull-down to low', () => {
    const pin = gpio();
    pin.padValue = INPUT_ENABLE | PULLDOWN;
    expect(pin.inputValue).toBe(false);
  });

  it('ignores a configured pull-up once the pin is actively driven', () => {
    // An external driver (button harness, another simulated peripheral) pulling the pin low
    // takes priority over a configured pull-up, same as real hardware.
    const pin = gpio();
    pin.padValue = INPUT_ENABLE | PULLUP;
    pin.setInputValue(false);
    expect(pin.inputValue).toBe(false);
  });

  it('keeps an actively-driven reading across inputEnable toggling', () => {
    // Regression test: refreshInput() (called whenever inputEnable changes, e.g. from a pad
    // register write) used to go through setInputValue() and would incorrectly mark the pin as
    // freshly "driven" using its last raw value - which would have permanently pinned an
    // undriven, pulled-up pin to its stale default the moment inputEnable was toggled, defeating
    // pull resolution entirely.
    const pin = gpio();
    pin.padValue = INPUT_ENABLE | PULLUP;
    pin.refreshInput();
    expect(pin.inputValue).toBe(true);

    pin.setInputValue(true);
    pin.padValue = 0; // disable inputEnable
    pin.padValue = INPUT_ENABLE | PULLUP; // re-enable
    pin.refreshInput();
    expect(pin.inputValue).toBe(true); // still reflects the earlier explicit drive
  });

  it('falls back to the raw value for bus-keeper mode when undriven', () => {
    // Both pulls enabled (bus-keeper mode) isn't covered by the pull-resolution fix - falls back
    // to the plain default, same as before.
    const pin = gpio();
    pin.padValue = INPUT_ENABLE | PULLUP | PULLDOWN;
    expect(pin.inputValue).toBe(false);
  });
});
