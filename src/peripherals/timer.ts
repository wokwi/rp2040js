import { getCurrentMicroseconds } from '../util/time';
import { LoggingPeripheral, Peripheral } from './peripheral';

const TIMEHR = 0x08;
const TIMELR = 0x0c;
const TIMERAWH = 0x24;
const TIMERAWL = 0x28;

const ALARM_0 = 1 << 0;
const ALARM_1 = 1 << 1;
const ALARM_2 = 1 << 2;
const ALARM_3 = 1 << 3;

export class RPTimer extends LoggingPeripheral implements Peripheral {
  latchedTimeHigh = 0;

  readUint32(offset: number) {
    const time = getCurrentMicroseconds();

    switch (offset) {
      case TIMEHR:
        return this.latchedTimeHigh;

      case TIMELR:
        this.latchedTimeHigh = Math.floor(time / 2 ** 32);
        return time >>> 0;

      case TIMERAWH:
        return Math.floor(time / 2 ** 32);

      case TIMERAWL:
        return time >>> 0;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      default:
        super.writeUint32(offset, value);
    }
  }
}
