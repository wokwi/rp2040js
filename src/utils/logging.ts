/* eslint-disable @typescript-eslint/no-explicit-any */
export interface LogInterface {
    debug(msg: string, ...supportingData: any[]): void;
    warn(msg: string, ...supportingData: any[]): void;
    error(msg: string, ...supportingData: any[]): void;
    info(msg: string, ...supportingData: any[]): void;
}

export enum LogLevel {
    debug,
    info,
    warn,
    error
}


export class Log implements LogInterface {
    public currentLogLevel = LogLevel.info;
    private exitonerror = true;

    constructor(loglevel: LogLevel, exitonerror: boolean) {
        this.currentLogLevel = loglevel;
        this.exitonerror = exitonerror;
    }

    private aboveLogLevel(loglevel: LogLevel): boolean {
        return loglevel >= this.currentLogLevel ? true: false;
    }

    debug(msg: string, ...supportingData: any[]): void {
        this.emitLogMessage("debug", msg, supportingData);
    }

    warn(msg: string, ...supportingData: any[]): void {
        this.emitLogMessage("warn", msg, supportingData);
    }

    error(msg: string, ...supportingData: any[]): void {
        this.emitLogMessage("error", msg, supportingData);
        if(this.exitonerror) throw new Error(msg);
    }

    info(msg: string, ...supportingData: any[]): void {
        this.emitLogMessage("info", msg, supportingData);
    }

    private emitLogMessage(msgType: "debug" | "info" | "warn" | "error", msg: string, supportingData: any[]) {
        if(this.aboveLogLevel(LogLevel[msgType])) {
            if (supportingData.length > 0) {
                console[msgType](msg, supportingData);
            } else {
                console[msgType](msg);
            }
        }
    }
    
}