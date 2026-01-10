import { BasePeripheral, Peripheral } from './peripheral.js';

// XOSC register offsets
const XOSC_CTRL = 0x00;
const XOSC_STATUS = 0x04;
const XOSC_DORMANT = 0x08;
const XOSC_STARTUP = 0x0c;
const XOSC_COUNT = 0x1c;

// CTRL register bits
const CTRL_ENABLE_LSB = 12;
const CTRL_ENABLE_BITS = 0x00fff000;
const CTRL_FREQ_RANGE_BITS = 0x00000fff;

// CTRL ENABLE values
const CTRL_ENABLE_DISABLE = 0xd1e;
const CTRL_ENABLE_ENABLE = 0xfab;

// STATUS register bits
const STATUS_STABLE = 0x80000000; // bit 31
const STATUS_BADWRITE = 0x01000000; // bit 24
const STATUS_ENABLED = 0x00001000; // bit 12
const STATUS_FREQ_RANGE_BITS = 0x00000003;

// DORMANT register values
const DORMANT_VALUE = 0x636f6d61; // "coma" in ASCII
const WAKE_VALUE = 0x77616b65; // "wake" in ASCII

// STARTUP register bits
const STARTUP_X4 = 0x00100000; // bit 20
const STARTUP_DELAY_BITS = 0x00003fff;

export class RPXOSC extends BasePeripheral implements Peripheral {
  private ctrl = 0;
  private status = 0;
  private dormant = 0;
  private startup = 0;
  private count = 0;
  private enabled = false;
  private stable = false;
  private isDormant = false;

  readUint32(offset: number): number {
    switch (offset) {
      case XOSC_CTRL:
        return this.ctrl;

      case XOSC_STATUS: {
        let status = this.status;
        if (this.stable) {
          status |= STATUS_STABLE;
        }
        if (this.enabled) {
          status |= STATUS_ENABLED;
        }
        return status;
      }

      case XOSC_DORMANT:
        return this.dormant;

      case XOSC_STARTUP:
        return this.startup;

      case XOSC_COUNT:
        return this.count;
    }

    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number): void {
    switch (offset) {
      case XOSC_CTRL: {
        this.ctrl = value;
        const enableValue = (value & CTRL_ENABLE_BITS) >>> CTRL_ENABLE_LSB;
        const freqRange = value & CTRL_FREQ_RANGE_BITS;
        void freqRange; // Currently unused, but could be logged or validated

        if (enableValue === CTRL_ENABLE_ENABLE) {
          if (!this.isDormant) {
            this.enabled = true;
            // For simplicity, become stable immediately
            // In real hardware, this would take time based on STARTUP register
            this.stable = true;
          }
        } else if (enableValue === CTRL_ENABLE_DISABLE) {
          this.enabled = false;
          this.stable = false;
        } else if (enableValue !== 0) {
          // Invalid write to ENABLE field
          this.status |= STATUS_BADWRITE;
          this.warn(`Invalid ENABLE value written: 0x${enableValue.toString(16)}`);
        }
        break;
      }

      case XOSC_STATUS:
        // Clear BADWRITE bit if written as 1 (write-1-to-clear)
        if (value & STATUS_BADWRITE) {
          this.status &= ~STATUS_BADWRITE;
        }
        break;

      case XOSC_DORMANT:
        if (value === DORMANT_VALUE) {
          this.isDormant = true;
          this.stable = false;
        } else if (value === WAKE_VALUE) {
          this.isDormant = false;
          if (this.enabled) {
            this.stable = true;
          }
        }
        this.dormant = value;
        break;

      case XOSC_STARTUP:
        this.startup = value & (STARTUP_X4 | STARTUP_DELAY_BITS);
        break;

      case XOSC_COUNT:
        // Writing to COUNT starts the countdown
        this.count = value & 0xff;
        // For simplicity, we don't actually implement the countdown
        // In real hardware, this would decrement at the XOSC frequency
        break;

      default:
        super.writeUint32(offset, value);
    }
  }
}
