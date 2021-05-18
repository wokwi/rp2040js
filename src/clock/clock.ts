export interface IClockTimer {
  pause(currentMicros: number): void;
  resume(currentMicros: number): void;
}

export interface IClock {
  readonly micros: number;

  pause(): void;

  resume(): void;

  createTimer(deltaMicros: number, callback: () => void): IClockTimer;

  deleteTimer(timer: IClockTimer): void;
}
