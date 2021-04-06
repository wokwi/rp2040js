import { RP2040 } from '../rp2040';

export interface Peripheral {
  readUint32(offset: number): number;
  writeUint32(offset: number, value: number): void;
}

export class LoggingPeripheral implements Peripheral {
  constructor(protected rp2040: RP2040, readonly name: string) {}

  readUint32(offset: number) {
    console.warn(`Unimplemented peripheral ${this.name} read from ${offset.toString(16)}`);
    if (offset > 0x1000) {
      console.warn('Unimplemented read from peripheral in the atomic operation region');
    }
    return 0xffffffff;
  }

  writeUint32(offset: number, value: number) {
    console.warn(
      `Unimplemented peripheral ${this.name} write to ${offset.toString(16)}: ${value}`
    );
    if (offset > 0x1000) {
      console.warn(`Unimplemented atomic-write to peripheral ${this.name}`);
    }
  }
}

export class UnimplementedPeripheral extends LoggingPeripheral {}
