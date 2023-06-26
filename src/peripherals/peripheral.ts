import EventEmitter from 'eventemitter3';
import { RP2040 } from '../rp2040';

const ATOMIC_NORMAL = 0;
const ATOMIC_XOR = 1;
const ATOMIC_SET = 2;
const ATOMIC_CLEAR = 3;

export function atomicUpdate(currentValue: number, atomicType: number, newValue: number) {
  switch (atomicType) {
    case ATOMIC_XOR:
      return currentValue ^ newValue;
    case ATOMIC_SET:
      return currentValue | newValue;
    case ATOMIC_CLEAR:
      return currentValue & ~newValue;
    default:
      console.warn('Atomic update called with invalid writeType', atomicType);
      return newValue;
  }
}

export interface Peripheral {
  readUint32(offset: number): number;
  writeUint32(offset: number, value: number): void;
  writeUint32Atomic(offset: number, value: number, atomicType: number): void;
}

// eslint-disable-next-line @typescript-eslint/ban-types -- EventEmitter3 defines the allowed types as `object`, so copy that here
export class BasePeripheral<E extends object = Record<string, unknown>>
  extends EventEmitter<E>
  implements Peripheral {
  protected rawWriteValue = 0;

  constructor(protected rp2040: RP2040, readonly name: string) {
    super();
  }

  readUint32(offset: number) {
    this.warn(`Unimplemented peripheral read from ${offset.toString(16)}`);
    if (offset > 0x1000) {
      this.warn('Unimplemented read from peripheral in the atomic operation region');
    }
    return 0xffffffff;
  }

  writeUint32(offset: number, value: number) {
    this.warn(`Unimplemented peripheral write to ${offset.toString(16)}: ${value}`);
  }

  writeUint32Atomic(offset: number, value: number, atomicType: number) {
    this.rawWriteValue = value;
    const newValue =
      atomicType != ATOMIC_NORMAL
        ? atomicUpdate(this.readUint32(offset), atomicType, value)
        : value;
    this.writeUint32(offset, newValue);
  }

  debug(msg: string) {
    this.rp2040.logger.debug(this.name, msg);
  }

  info(msg: string) {
    this.rp2040.logger.info(this.name, msg);
  }

  warn(msg: string) {
    this.rp2040.logger.warn(this.name, msg);
  }

  error(msg: string) {
    this.rp2040.logger.error(this.name, msg);
  }
}

export class UnimplementedPeripheral extends BasePeripheral {}
