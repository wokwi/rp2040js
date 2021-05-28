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

export class BasePeripheral implements Peripheral {
  protected rawWriteValue = 0;

  constructor(protected rp2040: RP2040, readonly name: string) {}

  readUint32(offset: number) {
    this.rp2040.logger.warn(`Unimplemented peripheral ${this.name} read from ${offset.toString(16)}`);
    if (offset > 0x1000) {
      this.rp2040.logger.warn('Unimplemented read from peripheral in the atomic operation region');
    }
    return 0xffffffff;
  }

  writeUint32(offset: number, value: number) {
    this.rp2040.logger.warn(`Unimplemented peripheral ${this.name} write to ${offset.toString(16)}: ${value}`);
  }

  writeUint32Atomic(offset: number, value: number, atomicType: number) {
    this.rawWriteValue = value;
    const newValue =
      atomicType != ATOMIC_NORMAL
        ? atomicUpdate(this.readUint32(offset), atomicType, value)
        : value;
    this.writeUint32(offset, newValue);
  }
}

export class UnimplementedPeripheral extends BasePeripheral {}
