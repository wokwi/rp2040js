import { RP2040 } from './rp2040';

export enum GPIOPinState {
  Low,
  High,
  Input,
  InputPullUp,
  InputPullDown,
}

export class GPIOPin {
  constructor(readonly rp2040: RP2040, readonly index: number) {}

  get value() {
    const { index, rp2040 } = this;
    const bitmask = 1 << index;
    if (rp2040.sio.gpioOutputEnable & bitmask) {
      return rp2040.sio.gpioValue & bitmask ? GPIOPinState.High : GPIOPinState.Low;
    } else {
      // TODO account for pullup/pulldown
      return GPIOPinState.Input;
    }
  }

  // TODO add a way to listen for value changes
}
