import { formatTime } from './time.js';

export interface Logger {
  debug(componentName: string, message: string): void;
  warn(componentName: string, message: string): void;
  error(componentName: string, message: string): void;
  info(componentName: string, message: string): void;
}

export enum LogLevel {
  Debug,
  Info,
  Warn,
  Error,
}

export class ConsoleLogger implements Logger {
  constructor(
    public currentLogLevel: LogLevel,
    private throwOnError = true,
  ) {}

  private aboveLogLevel(logLevel: LogLevel): boolean {
    return logLevel >= this.currentLogLevel ? true : false;
  }

  private formatMessage(componentName: string, message: string) {
    const currentTime = formatTime(new Date());
    return `${currentTime} [${componentName}] ${message}`;
  }

  debug(componetName: string, message: string): void {
    if (this.aboveLogLevel(LogLevel.Debug)) {
      console.debug(this.formatMessage(componetName, message));
    }
  }

  warn(componetName: string, message: string): void {
    if (this.aboveLogLevel(LogLevel.Warn)) {
      console.warn(this.formatMessage(componetName, message));
    }
  }

  error(componentName: string, message: string): void {
    if (this.aboveLogLevel(LogLevel.Error)) {
      console.error(this.formatMessage(componentName, message));
      if (this.throwOnError) {
        throw new Error(`[${componentName}] ${message}`);
      }
    }
  }

  info(componentName: string, message: string): void {
    if (this.aboveLogLevel(LogLevel.Info)) {
      console.info(this.formatMessage(componentName, message));
    }
  }
}
