import { getCurrentMicroseconds } from '../utils/time';
import { IClock, IClockTimer } from './clock';

export class ClockTimer implements IClockTimer {
  private jsTimer: NodeJS.Timeout | null = null;
  private timeLeft: number = this.micros;

  constructor(private micros: number, private callback: () => void) {}

  schedule(currentMicros: number) {
    this.jsTimer = setTimeout(this.callback, (this.micros - currentMicros) / 1000);
  }

  unschedule() {
    if (this.jsTimer) {
      clearTimeout(this.jsTimer);
      this.jsTimer = null;
    }
  }

  pause(currentMicros: number) {
    this.timeLeft = this.micros - currentMicros;
    this.unschedule();
  }

  resume(currentMicros: number) {
    this.micros = currentMicros + this.timeLeft;
    this.schedule(currentMicros);
  }
}

export class RealtimeClock implements IClock {
  baseTime: number = 0;
  pauseTime: number = 0;
  paused = true;
  timers = new Set<ClockTimer>();

  pause() {
    if (!this.paused) {
      for (const timer of this.timers) {
        timer.pause(this.micros);
      }
      this.pauseTime = this.micros;
      this.paused = true;
    }
  }

  resume() {
    if (this.paused) {
      this.baseTime = getCurrentMicroseconds() - this.pauseTime;
      this.paused = false;
      for (const timer of this.timers) {
        timer.resume(this.micros);
      }
    }
  }

  createTimer(deltaMicros: number, callback: () => void) {
    const timer = new ClockTimer(this.micros + deltaMicros, () => {
      this.timers.delete(timer);
      callback();
    });
    timer.schedule(this.micros);
    this.timers.add(timer);
    return timer;
  }

  deleteTimer(timer: ClockTimer) {
    timer.unschedule();
    this.timers.delete(timer);
  }

  get micros() {
    return getCurrentMicroseconds() - this.baseTime;
  }
}
