import { BasePeripheral, Peripheral } from './peripheral';

const RTC_SETUP0 = 0x04;
const RTC_SETUP1 = 0x08;
const RTC_CTRL = 0x0c;
const IRQ_SETUP_0 = 0x10;
const RTC_RTC1 = 0x18;
const RTC_RTC0 = 0x1c;

const RTC_ENABLE_BITS = 0x01;
const RTC_ACTIVE_BITS = 0x2;
const RTC_LOAD_BITS = 0x10;

export class RP2040RTC extends BasePeripheral implements Peripheral {
  setup0 = 0;
  setup1 = 0;
  rtc1 = 0;
  rtc0 = 0;
  ctrl = 0;

  readUint32(offset: number) {
    switch (offset) {
      case RTC_SETUP0:
        return this.setup0;
      case RTC_SETUP1:
        return this.setup1;
      case RTC_CTRL:
        return this.ctrl;
      case IRQ_SETUP_0:
        return 0;
      case RTC_RTC1:
        return this.rtc1;
      case RTC_RTC0:
        return this.rtc0;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case RTC_SETUP0:
        this.setup0 = value;
        break;
      case RTC_SETUP1:
        this.setup1 = value;
        break;
      case RTC_CTRL:
        // Though RTC_LOAD_BITS is type SC and should be cleared on next cycle, pico-sdk write
        // RTC_LOAD_BITS & RTC_ENABLE_BITS seperatly.
        // https://github.com/raspberrypi/pico-sdk/blob/master/src/rp2_common/hardware_rtc/rtc.c#L76-L80
        if (value & RTC_LOAD_BITS) {
          this.ctrl |= RTC_LOAD_BITS;
        }
        if (value & RTC_ENABLE_BITS) {
          this.ctrl |= RTC_ENABLE_BITS;
          this.ctrl |= RTC_ACTIVE_BITS;
          if (this.ctrl & RTC_LOAD_BITS) {
            this.rtc1 = this.setup0;
            this.rtc0 = this.setup1;
            this.ctrl &= ~RTC_LOAD_BITS;
          }
        } else {
          this.ctrl &= ~RTC_ENABLE_BITS;
          this.ctrl &= ~RTC_ACTIVE_BITS;
        }
        break;
      default:
        super.writeUint32(offset, value);
    }
  }
}
