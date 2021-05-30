import { getCurrentTimeWithMilliseconds } from './time';

export interface Logging {
  debug(name: string, msg: string): void;
  warn(name: string, msg: string): void;
  error(name: string, msg: string): void;
  info(name: string, msg: string): void;
}

export enum LogLevel {
  Debug,
  Info,
  Warn,
  Error,
}

export class ConsoleLogger implements Logging {
  constructor(public currentLogLevel: LogLevel, private throwOnError: boolean) {
    this.currentLogLevel = currentLogLevel;
    this.throwOnError = throwOnError;
  }

  private aboveLogLevel(loglevel: LogLevel): boolean {
    return loglevel >= this.currentLogLevel ? true : false;
  }

  private formatMessage(name: string, msg: string) {
    const currenttime = getCurrentTimeWithMilliseconds();
    return `${currenttime} [${name}] ${msg}`;
  }

  debug(name: string, msg: string): void {
    if (this.aboveLogLevel(LogLevel.Debug)) {
      console.debug(this.formatMessage(name, msg));
    }
  }

  warn(name: string, msg: string): void {
    if (this.aboveLogLevel(LogLevel.Warn)) {
      console.warn(this.formatMessage(name, msg));
    }
  }

  error(name: string, msg: string): void {
    if (this.aboveLogLevel(LogLevel.Error)) {
      console.error(this.formatMessage(name, msg));
      if (this.throwOnError) throw new Error(msg);
    }
  }

  info(name: string, msg: string): void {
    if (this.aboveLogLevel(LogLevel.Info)) {
      console.info(this.formatMessage(name, msg));
    }
  }
}
