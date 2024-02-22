import { BasePeripheral, Peripheral } from './peripheral.js';

const RTC_SETUP0 = 0x04;
const RTC_SETUP1 = 0x08;
const RTC_CTRL = 0x0c;
const IRQ_SETUP_0 = 0x10;
const RTC_RTC1 = 0x18;
const RTC_RTC0 = 0x1c;

const RTC_ENABLE_BITS = 0x01;
const RTC_ACTIVE_BITS = 0x2;
const RTC_LOAD_BITS = 0x10;

const SETUP_0_YEAR_SHIFT = 12;
const SETUP_0_YEAR_MASK = 0xfff;
const SETUP_0_MONTH_SHIFT = 8;
const SETUP_0_MONTH_MASK = 0xf;
const SETUP_0_DAY_SHIFT = 0;
const SETUP_0_DAY_MASK = 0x1f;

const SETUP_1_DOTW_SHIFT = 24;
const SETUP_1_DOTW_MASK = 0x7;
const SETUP_1_HOUR_SHIFT = 16;
const SETUP_1_HOUR_MASK = 0x1f;
const SETUP_1_MIN_SHIFT = 8;
const SETUP_1_MIN_MASK = 0x3f;
const SETUP_1_SEC_SHIFT = 0;
const SETUP_1_SEC_MASK = 0x3f;

const RTC_0_YEAR_SHIFT = 12;
const RTC_0_YEAR_MASK = 0xfff;
const RTC_0_MONTH_SHIFT = 8;
const RTC_0_MONTH_MASK = 0xf;
const RTC_0_DAY_SHIFT = 0;
const RTC_0_DAY_MASK = 0x1f;

const RTC_1_DOTW_SHIFT = 24;
const RTC_1_DOTW_MASK = 0x7;
const RTC_1_HOUR_SHIFT = 16;
const RTC_1_HOUR_MASK = 0x1f;
const RTC_1_MIN_SHIFT = 8;
const RTC_1_MIN_MASK = 0x3f;
const RTC_1_SEC_SHIFT = 0;
const RTC_1_SEC_MASK = 0x3f;

export class RP2040RTC extends BasePeripheral implements Peripheral {
  setup0 = 0;
  setup1 = 0;
  ctrl = 0;
  baseline = new Date(2021, 0, 1);
  baselineNanos = 0;

  readUint32(offset: number) {
    const date = new Date(
      this.baseline.getTime() + (this.rp2040.clock.nanos - this.baselineNanos) / 1_000_000,
    );
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
        return (
          ((date.getFullYear() & RTC_0_YEAR_MASK) << RTC_0_YEAR_SHIFT) |
          (((date.getMonth() + 1) & RTC_0_MONTH_MASK) << RTC_0_MONTH_SHIFT) |
          ((date.getDate() & RTC_0_DAY_MASK) << RTC_0_DAY_SHIFT)
        );
      case RTC_RTC0:
        return (
          ((date.getDay() & RTC_1_DOTW_MASK) << RTC_1_DOTW_SHIFT) |
          ((date.getHours() & RTC_1_HOUR_MASK) << RTC_1_HOUR_SHIFT) |
          ((date.getMinutes() & RTC_1_MIN_MASK) << RTC_1_MIN_SHIFT) |
          ((date.getSeconds() & RTC_1_SEC_MASK) << RTC_1_SEC_SHIFT)
        );
      default:
        break;
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
            const year = (this.setup0 >> SETUP_0_YEAR_SHIFT) & SETUP_0_YEAR_MASK;
            const month = (this.setup0 >> SETUP_0_MONTH_SHIFT) & SETUP_0_MONTH_MASK;
            const day = (this.setup0 >> SETUP_0_DAY_SHIFT) & SETUP_0_DAY_MASK;
            const hour = (this.setup1 >> SETUP_1_HOUR_SHIFT) & SETUP_1_HOUR_MASK;
            const min = (this.setup1 >> SETUP_1_MIN_SHIFT) & SETUP_1_MIN_MASK;
            const sec = (this.setup1 >> SETUP_1_SEC_SHIFT) & SETUP_1_SEC_MASK;
            this.baseline = new Date(year, month - 1, day, hour, min, sec);
            this.baselineNanos = this.rp2040.clock.nanos;
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
