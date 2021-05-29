export interface Logging {
  debug(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  info(msg: string): void;
}

export enum LogLevel {
  Debug,
  Info,
  Warn,
  Error,
}

export class ConsoleLogger implements Logging {
  public currentLogLevel;
  private throwOnError;
  private loggerName;

  constructor(name: string, currentLogLevel: LogLevel, throwOnError: boolean) {
    this.currentLogLevel = currentLogLevel;
    this.throwOnError = throwOnError;
    this.loggerName = name;
  }

  private aboveLogLevel(loglevel: LogLevel): boolean {
    return loglevel >= this.currentLogLevel ? true : false;
  }

  private formatMessage(name: string, msg: string) {
    const currenttime = new Date().toLocaleString();
    return `${currenttime} [${name}] ${msg}`;
  }

  debug(msg: string): void {
    if (this.aboveLogLevel(LogLevel.Debug)) console.debug(this.formatMessage(this.loggerName, msg));
  }

  warn(msg: string): void {
    if (this.aboveLogLevel(LogLevel.Warn)) console.warn(this.formatMessage(this.loggerName, msg));
  }

  error(msg: string): void {
    if (this.aboveLogLevel(LogLevel.Error)) {
      console.error(this.formatMessage(this.loggerName, msg));
      if (this.throwOnError) throw new Error(msg);
    }
  }

  info(msg: string): void {
    if (this.aboveLogLevel(LogLevel.Info)) console.info(this.formatMessage(this.loggerName, msg));
  }
}
