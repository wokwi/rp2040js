import { RP2040 } from '../rp2040.js';
import { Timer32, Timer32PeriodicAlarm, TimerMode } from '../utils/timer32.js';
import { BasePeripheral, Peripheral } from './peripheral.js';

const CTRL = 0x00; // Control register
const LOAD = 0x04; // Load the watchdog timer.
const REASON = 0x08; // Logs the reason for the last reset.
const SCRATCH0 = 0x0c; // Scratch register
const SCRATCH1 = 0x10; // Scratch register
const SCRATCH2 = 0x14; // Scratch register
const SCRATCH3 = 0x18; // Scratch register
const SCRATCH4 = 0x1c; // Scratch register
const SCRATCH5 = 0x20; // Scratch register
const SCRATCH6 = 0x24; // Scratch register
const SCRATCH7 = 0x28; // Scratch register
const TICK = 0x2c; // Controls the tick generator

// CTRL bits:
const TRIGGER = 1 << 31;
const ENABLE = 1 << 30;
const PAUSE_DBG1 = 1 << 26;
const PAUSE_DBG0 = 1 << 25;
const PAUSE_JTAG = 1 << 24;
const TIME_MASK = 0xffffff;
const TIME_SHIFT = 0;

// LOAD bits
const LOAD_MASK = 0xffffff;
const LOAD_SHIFT = 0;

// REASON bits:
const FORCE = 1 << 1;
const TIMER = 1 << 0;

// TICK bits:
const COUNT_MASK = 0x1ff;
const COUNT_SHIFT = 11;
const RUNNING = 1 << 10;
const TICK_ENABLE = 1 << 9;
const CYCLES_MASK = 0x1ff;
const CYCLES_SHIFT = 0;

const TICK_FREQUENCY = 2_000_000; // Actually 1 MHz, but due to errata RP2040-E1, the timer is decremented twice per tick

export class RPWatchdog extends BasePeripheral implements Peripheral {
  readonly timer;
  readonly alarm;
  readonly scratchData = new Uint32Array(8);

  private enable = false;
  private tickEnable = true;
  private reason = 0;
  private pauseDbg0 = true;
  private pauseDbg1 = true;
  private pauseJtag = true;

  /** Called when the watchdog triggers - override with your own soft reset implementation */
  onWatchdogTrigger = () => {
    this.rp2040.logger.warn(this.name, 'Watchdog triggered, but no reset handler provided');
  };

  // User provided
  constructor(rp2040: RP2040, name: string) {
    super(rp2040, name);
    this.timer = new Timer32(rp2040.clock, TICK_FREQUENCY);
    this.timer.mode = TimerMode.Decrement;
    this.timer.enable = false;
    this.alarm = new Timer32PeriodicAlarm(this.timer, () => {
      this.reason = TIMER;
      this.onWatchdogTrigger?.();
    });
    this.alarm.target = 0;
    this.alarm.enable = false;
  }

  readUint32(offset: number) {
    switch (offset) {
      case CTRL:
        return (
          (this.timer.enable ? ENABLE : 0) |
          (this.pauseDbg0 ? PAUSE_DBG0 : 0) |
          (this.pauseDbg1 ? PAUSE_DBG1 : 0) |
          (this.pauseJtag ? PAUSE_JTAG : 0) |
          ((this.timer.counter & TIME_MASK) << TIME_SHIFT)
        );

      case REASON:
        return this.reason;

      case SCRATCH0:
      case SCRATCH1:
      case SCRATCH2:
      case SCRATCH3:
      case SCRATCH4:
      case SCRATCH5:
      case SCRATCH6:
      case SCRATCH7:
        return this.scratchData[(offset - SCRATCH0) >> 2];

      case TICK:
        // TODO COUNT bits
        return this.tickEnable ? RUNNING | TICK_ENABLE : 0;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case CTRL:
        if (value & TRIGGER) {
          this.reason = FORCE;
          this.onWatchdogTrigger?.();
        }
        this.enable = !!(value & ENABLE);
        this.timer.enable = this.enable && this.tickEnable;
        this.alarm.enable = this.enable && this.tickEnable;
        this.pauseDbg0 = !!(value & PAUSE_DBG0);
        this.pauseDbg1 = !!(value & PAUSE_DBG1);
        this.pauseJtag = !!(value & PAUSE_JTAG);
        break;

      case LOAD:
        this.timer.set((value >>> LOAD_SHIFT) & LOAD_MASK);
        break;

      case SCRATCH0:
      case SCRATCH1:
      case SCRATCH2:
      case SCRATCH3:
      case SCRATCH4:
      case SCRATCH5:
      case SCRATCH6:
      case SCRATCH7:
        this.scratchData[(offset - SCRATCH0) >> 2] = value;
        break;

      case TICK:
        this.tickEnable = !!(value & TICK_ENABLE);
        this.timer.enable = this.enable && this.tickEnable;
        this.alarm.enable = this.enable && this.tickEnable;
        // TODO - handle CYCLES (tick also affectes timer)
        break;

      default:
        super.writeUint32(offset, value);
    }
  }
}
