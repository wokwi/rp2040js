export type AlarmCallback = () => void;

export interface IAlarm {
  schedule(deltaNanos: number): void;
  cancel(): void;
}

export interface IClock {
  readonly nanos: number;

  createAlarm(callback: AlarmCallback): IAlarm;
}
