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

  readonly timers: MockClockTimer[] = [];

  pause() {
    /* intentionally empty */
  }

  resume() {
    /* intentionally empty */
  }

  advance(deltaMicros: number) {
    const { timers } = this;
    const targetTime = this.micros + Math.max(deltaMicros, 0.01);
    while (timers[0] && timers[0].micros <= targetTime) {
      const timer = timers.shift();
      if (timer) {
        this.micros = timer.micros;
        timer.callback();
      }
    }
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
