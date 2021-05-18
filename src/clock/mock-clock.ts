import { IClock, IClockTimer } from './clock';

export class MockClockTimer implements IClockTimer {
  constructor(readonly micros: number, readonly callback: () => void) {}

  pause() {
    /* intentionally empty */
  }

  resume() {
    /* intentionally empty */
  }
}

export class MockClock implements IClock {
  micros: number = 0;

  private readonly timers: MockClockTimer[] = [];

  pause() {
    /* intentionally empty */
  }

  resume() {
    /* intentionally empty */
  }

  advance(deltaMicros: number) {
    const { timers } = this;
    const targetTime = this.micros + deltaMicros;
    while (timers[0] && timers[0].micros <= targetTime) {
      const timer = timers.shift();
      timer?.callback();
    }
    this.micros += deltaMicros;
  }

  createTimer(deltaMicros: number, callback: () => void) {
    const timer = new MockClockTimer(this.micros + deltaMicros, callback);
    this.timers.push(timer);
    this.timers.sort((a, b) => a.micros - b.micros);
    return timer;
  }

  deleteTimer(timer: IClockTimer) {
    const timerIndex = this.timers.indexOf(timer as MockClockTimer);
    if (timerIndex >= 0) {
      this.timers.splice(timerIndex, 1);
    }
  }
}
