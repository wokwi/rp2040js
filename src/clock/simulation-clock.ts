import { AlarmCallback, IAlarm, IClock } from './clock.js';

type ClockEventCallback = () => void;

export class ClockAlarm implements IAlarm {
  next: ClockAlarm | null = null;
  nanos: number = 0;
  scheduled = false;

  constructor(
    private readonly clock: SimulationClock,
    readonly callback: AlarmCallback,
  ) {}

  schedule(deltaNanos: number): void {
    if (this.scheduled) {
      this.cancel();
    }
    this.clock.linkAlarm(deltaNanos, this);
  }

  cancel(): void {
    this.clock.unlinkAlarm(this);
    this.scheduled = false;
  }
}

export class SimulationClock implements IClock {
  private nextAlarm: ClockAlarm | null = null;

  private nanosCounter = 0;

  constructor(readonly frequency = 125e6) {}

  get nanos() {
    return this.nanosCounter;
  }

  get micros() {
    return this.nanos / 1000;
  }

  createAlarm(callback: ClockEventCallback) {
    return new ClockAlarm(this, callback);
  }

  linkAlarm(nanos: number, alarm: ClockAlarm) {
    alarm.nanos = this.nanos + nanos;
    let alarmListItem = this.nextAlarm;
    let lastItem = null;
    while (alarmListItem && alarmListItem.nanos < alarm.nanos) {
      lastItem = alarmListItem;
      alarmListItem = alarmListItem.next;
    }
    if (lastItem) {
      lastItem.next = alarm;
      alarm.next = alarmListItem;
    } else {
      this.nextAlarm = alarm;
      alarm.next = alarmListItem;
    }
    alarm.scheduled = true;
    return alarm;
  }

  unlinkAlarm(alarm: ClockAlarm) {
    let alarmListItem = this.nextAlarm;
    if (!alarmListItem) {
      return false;
    }
    let lastItem = null;
    while (alarmListItem) {
      if (alarmListItem === alarm) {
        if (lastItem) {
          lastItem.next = alarmListItem.next;
        } else {
          this.nextAlarm = alarmListItem.next;
        }
        return true;
      }
      lastItem = alarmListItem;
      alarmListItem = alarmListItem.next;
    }
    return false;
  }

  tick(deltaNanos: number) {
    const targetNanos = this.nanosCounter + deltaNanos;
    let alarm = this.nextAlarm;
    while (alarm && alarm.nanos <= targetNanos) {
      this.nextAlarm = alarm.next;
      this.nanosCounter = alarm.nanos;
      alarm.callback();
      alarm = this.nextAlarm;
    }
    this.nanosCounter = targetNanos;
  }

  get nanosToNextAlarm() {
    if (this.nextAlarm) {
      return this.nextAlarm.nanos - this.nanos;
    }
    return 0;
  }
}
