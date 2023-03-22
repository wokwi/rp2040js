import { IClock, IClockTimer } from '../clock/clock';

export enum TimerMode {
  Increment,
  Decrement,
  ZigZag,
}

export class Timer32 {
  private baseValue = 0;
  private baseMicros = 0;
  private topValue = 0xffffffff;
  private prescalerValue = 1;
  private timerMode = TimerMode.Increment;
  private enabled = true;
  readonly listeners: (() => void)[] = [];

  constructor(readonly clock: IClock, private baseFreq: number) {}

  reset() {
    this.baseMicros = this.clock.micros;
    this.baseValue = 0;
    this.updated();
  }

  set(value: number, zigZagDown = false) {
    this.baseValue = zigZagDown ? this.topValue * 2 - value : value;
    this.baseMicros = this.clock.micros;
    this.updated();
  }

  /**
   * Advances the counter by the given amount. Note that this will
   * decrease the counter if the timer is running in Decrement mode.
   *
   * @param delta The value to add to the counter. Can be negative.
   */
  advance(delta: number) {
    this.baseValue += delta;
  }

  get rawCounter() {
    const { baseFreq, prescalerValue, baseMicros, baseValue, enabled, timerMode } = this;
    if (!baseFreq || !prescalerValue || !enabled) {
      return this.baseValue;
    }
    const zigzag = timerMode == TimerMode.ZigZag;
    const ticks = ((this.clock.micros - baseMicros) / 1e6) * (baseFreq / prescalerValue);
    const topModulo = zigzag ? this.topValue * 2 : this.topValue + 1;
    const delta = timerMode == TimerMode.Decrement ? topModulo - (ticks % topModulo) : ticks;
    let currentValue = Math.round(baseValue + delta);
    if (this.topValue != 0xffffffff) {
      currentValue %= topModulo;
    }
    return currentValue;
  }

  get counter() {
    let currentValue = this.rawCounter;
    if (this.timerMode == TimerMode.ZigZag && currentValue > this.topValue) {
      currentValue = this.topValue * 2 - currentValue;
    }
    return currentValue >>> 0;
  }

  get top() {
    return this.topValue;
  }

  set top(value: number) {
    const { counter } = this;
    this.topValue = value;
    this.set(counter <= this.topValue ? counter : 0);
  }

  get frequency() {
    return this.baseFreq;
  }

  set frequency(value: number) {
    this.baseValue = this.counter;
    this.baseMicros = this.clock.micros;
    this.baseFreq = value;
    this.updated();
  }

  get prescaler() {
    return this.prescalerValue;
  }

  set prescaler(value: number) {
    this.baseValue = this.counter;
    this.baseMicros = this.clock.micros;
    this.enabled = this.prescalerValue !== 0;
    this.prescalerValue = value;
    this.updated();
  }

  toMicros(cycles: number) {
    const { baseFreq, prescalerValue } = this;
    return (cycles * 1e6) / (baseFreq / prescalerValue);
  }

  get enable() {
    return this.enabled;
  }

  set enable(value: boolean) {
    if (value !== this.enabled) {
      if (value) {
        this.baseMicros = this.clock.micros;
      } else {
        this.baseValue = this.counter;
      }
      this.enabled = value;
      this.updated();
    }
  }

  get mode() {
    return this.timerMode;
  }

  set mode(value: TimerMode) {
    if (this.timerMode !== value) {
      const { counter } = this;
      this.timerMode = value;
      this.set(counter);
    }
  }

  private updated() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export class Timer32PeriodicAlarm {
  private targetValue = 0;
  private enabled = false;
  private clockTimer?: IClockTimer;

  constructor(readonly timer: Timer32, readonly callback: () => void) {
    timer.listeners.push(this.update);
  }

  get enable() {
    return this.enabled;
  }

  set enable(value: boolean) {
    if (value !== this.enabled) {
      this.enabled = value;
      if (value && this.timer.enable) {
        this.schedule();
      } else {
        this.cancel();
      }
    }
  }

  get target() {
    return this.targetValue;
  }

  set target(value: number) {
    if (value === this.targetValue) {
      return;
    }
    this.targetValue = value;
    if (this.enabled && this.timer.enable) {
      this.cancel();
      this.schedule();
    }
  }

  handleAlarm = () => {
    this.callback();
    if (this.enabled && this.timer.enable) {
      this.schedule();
    }
  };

  update = () => {
    this.cancel();
    if (this.enabled && this.timer.enable) {
      this.schedule();
    }
  };

  private schedule() {
    const { timer, targetValue } = this;
    const { top, mode, rawCounter } = timer;
    let cycleDelta = targetValue - rawCounter;
    if (mode === TimerMode.ZigZag && cycleDelta < 0) {
      if (cycleDelta < -top) {
        cycleDelta += 2 * top;
      } else {
        cycleDelta = top * 2 - targetValue - rawCounter;
      }
    }
    if (top != 0xffffffff) {
      if (cycleDelta < 0) {
        cycleDelta += top + 1;
      }
      if (targetValue > top) {
        // Skip alarm
        return;
      }
    }
    if (mode === TimerMode.Decrement) {
      cycleDelta = top + 1 - cycleDelta;
    }
    const cyclesToAlarm = cycleDelta >>> 0;
    const microsToAlarm = timer.toMicros(cyclesToAlarm);
    this.clockTimer = this.timer.clock.createTimer(microsToAlarm, this.handleAlarm);
  }

  private cancel() {
    if (this.clockTimer) {
      this.timer.clock.deleteTimer(this.clockTimer);
      this.clockTimer = undefined;
    }
  }
}
