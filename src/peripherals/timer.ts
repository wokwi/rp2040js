import { IClock, IAlarm } from '../clock/clock.js';
import { IRQ } from '../irq.js';
import { RP2040 } from '../rp2040.js';
import { BasePeripheral, Peripheral } from './peripheral.js';

const TIMEHR = 0x08;
const TIMELR = 0x0c;
const TIMERAWH = 0x24;
const TIMERAWL = 0x28;
const ALARM0 = 0x10;
const ALARM1 = 0x14;
const ALARM2 = 0x18;
const ALARM3 = 0x1c;
const ARMED = 0x20;
const PAUSE = 0x30;
const INTR = 0x34;
const INTE = 0x38;
const INTF = 0x3c;
const INTS = 0x40;

const ALARM_0 = 1 << 0;
const ALARM_1 = 1 << 1;
const ALARM_2 = 1 << 2;
const ALARM_3 = 1 << 3;

const timerInterrupts = [IRQ.TIMER_0, IRQ.TIMER_1, IRQ.TIMER_2, IRQ.TIMER_3];

class RPTimerAlarm {
  armed = false;
  targetMicros = 0;

  constructor(
    readonly bitValue: number,
    readonly clockAlarm: IAlarm,
  ) {}
}

export class RPTimer extends BasePeripheral implements Peripheral {
  private readonly clock: IClock;
  private latchedTimeHigh = 0;
  private readonly alarms;
  private intRaw = 0;
  private intEnable = 0;
  private intForce = 0;
  private paused = false;

  constructor(rp2040: RP2040, name: string) {
    super(rp2040, name);
    this.clock = rp2040.clock;
    this.alarms = [
      new RPTimerAlarm(
        ALARM_0,
        this.clock.createAlarm(() => this.fireAlarm(0)),
      ),
      new RPTimerAlarm(
        ALARM_1,
        this.clock.createAlarm(() => this.fireAlarm(1)),
      ),
      new RPTimerAlarm(
        ALARM_2,
        this.clock.createAlarm(() => this.fireAlarm(2)),
      ),
      new RPTimerAlarm(
        ALARM_3,
        this.clock.createAlarm(() => this.fireAlarm(3)),
      ),
    ];
  }

  get intStatus() {
    return (this.intRaw & this.intEnable) | this.intForce;
  }

  readUint32(offset: number) {
    const time = this.clock.nanos / 1000;

    switch (offset) {
      case TIMEHR:
        return this.latchedTimeHigh;

      case TIMELR:
        this.latchedTimeHigh = Math.floor(time / 2 ** 32);
        return time >>> 0;

      case TIMERAWH:
        return Math.floor(time / 2 ** 32);

      case TIMERAWL:
        return time >>> 0;

      case ALARM0:
        return this.alarms[0].targetMicros;
      case ALARM1:
        return this.alarms[1].targetMicros;
      case ALARM2:
        return this.alarms[2].targetMicros;
      case ALARM3:
        return this.alarms[3].targetMicros;

      case PAUSE:
        return this.paused ? 1 : 0;

      case INTR:
        return this.intRaw;
      case INTE:
        return this.intEnable;
      case INTF:
        return this.intForce;
      case INTS:
        return this.intStatus;

      case ARMED:
        return (
          (this.alarms[0].armed ? this.alarms[0].bitValue : 0) |
          (this.alarms[1].armed ? this.alarms[1].bitValue : 0) |
          (this.alarms[2].armed ? this.alarms[2].bitValue : 0) |
          (this.alarms[3].armed ? this.alarms[3].bitValue : 0)
        );
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case ALARM0:
      case ALARM1:
      case ALARM2:
      case ALARM3: {
        const alarmIndex = (offset - ALARM0) / 4;
        const alarm = this.alarms[alarmIndex];
        const deltaMicros = (value - this.clock.nanos / 1000) >>> 0;
        alarm.armed = true;
        alarm.targetMicros = value;
        alarm.clockAlarm.schedule(deltaMicros * 1000);
        break;
      }
      case ARMED:
        for (const alarm of this.alarms) {
          if (this.rawWriteValue & alarm.bitValue) {
            this.disarmAlarm(alarm);
          }
        }
        break;
      case PAUSE:
        this.paused = !!(value & 1);
        if (this.paused) {
          this.warn('Unimplemented Timer Pause');
        }
        // TODO actually pause the timer
        break;
      case INTR:
        this.intRaw &= ~this.rawWriteValue;
        this.checkInterrupts();
        break;
      case INTE:
        this.intEnable = value & 0xf;
        this.checkInterrupts();
        break;
      case INTF:
        this.intForce = value & 0xf;
        this.checkInterrupts();
        break;
      default:
        super.writeUint32(offset, value);
    }
  }

  private fireAlarm(index: number) {
    const alarm = this.alarms[index];
    this.disarmAlarm(alarm);
    this.intRaw |= alarm.bitValue;
    this.checkInterrupts();
  }

  private checkInterrupts() {
    const { intStatus } = this;
    for (let i = 0; i < this.alarms.length; i++) {
      this.rp2040.setInterrupt(timerInterrupts[i], !!(intStatus & (1 << i)));
    }
  }

  private disarmAlarm(alarm: RPTimerAlarm) {
    alarm.clockAlarm.cancel();
    alarm.armed = false;
  }
}
