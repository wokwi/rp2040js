import { SYSM_CONTROL, SYSM_MSP, SYSM_PRIMASK, SYSM_PSP } from '../src/cortex-m0-core';
import { RP2040 } from '../src/rp2040';
import { ICortexRegisterName, ICortexRegisters, ICortexTestDriver } from './test-driver';

export class RP2040TestDriver implements ICortexTestDriver {
  constructor(readonly rp2040: RP2040) {}

  async init() {
    /* this page intentionally left blank ! */
  }

  async tearDown() {
    this.rp2040.pio[0].stop();
    this.rp2040.pio[1].stop();
  }

  async setPC(pcValue: number) {
    this.rp2040.core0.PC = pcValue;
  }

  async writeUint8(address: number, value: number) {
    this.rp2040.writeUint8(address, value);
  }

  async writeUint16(address: number, value: number) {
    this.rp2040.writeUint16(address, value);
  }

  async writeUint32(address: number, value: number) {
    this.rp2040.writeUint32(address, value);
  }

  async setRegisters(registers: Partial<ICortexRegisters>) {
    const { rp2040 } = this;
    const core = rp2040.core0;
    for (const key of Object.keys(registers) as ICortexRegisterName[]) {
      const value = registers[key] as number;
      const boolValue = registers[key] as boolean;
      switch (key) {
        case 'r0':
          core.registers[0] = value;
          break;
        case 'r1':
          core.registers[1] = value;
          break;
        case 'r2':
          core.registers[2] = value;
          break;
        case 'r3':
          core.registers[3] = value;
          break;
        case 'r4':
          core.registers[4] = value;
          break;
        case 'r5':
          core.registers[5] = value;
          break;
        case 'r6':
          core.registers[6] = value;
          break;
        case 'r7':
          core.registers[7] = value;
          break;
        case 'r8':
          core.registers[8] = value;
          break;
        case 'r9':
          core.registers[9] = value;
          break;
        case 'r10':
          core.registers[10] = value;
          break;
        case 'r11':
          core.registers[11] = value;
          break;
        case 'r12':
          core.registers[12] = value;
          break;
        case 'sp':
          core.registers[13] = value;
          break;
        case 'lr':
          core.registers[14] = value;
          break;
        case 'pc':
          core.registers[15] = value;
          break;
        case 'xPSR':
          core.xPSR = value;
          break;
        case 'MSP':
          core.writeSpecialRegister(SYSM_MSP, value);
          break;
        case 'PSP':
          core.writeSpecialRegister(SYSM_PSP, value);
          break;
        case 'PRIMASK':
          core.writeSpecialRegister(SYSM_PRIMASK, value);
          break;
        case 'CONTROL':
          core.writeSpecialRegister(SYSM_CONTROL, value);
          break;
        case 'N':
          core.N = boolValue;
          break;
        case 'Z':
          core.Z = boolValue;
          break;
        case 'C':
          core.C = boolValue;
          break;
        case 'V':
          core.V = boolValue;
          break;
      }
    }
  }

  async singleStep() {
    this.rp2040.step();
  }

  async readRegisters(): Promise<ICortexRegisters> {
    const core = this.rp2040.core0;
    const { registers, xPSR } = core;
    return {
      r0: registers[0],
      r1: registers[1],
      r2: registers[2],
      r3: registers[3],
      r4: registers[4],
      r5: registers[5],
      r6: registers[6],
      r7: registers[7],
      r8: registers[8],
      r9: registers[9],
      r10: registers[10],
      r11: registers[11],
      r12: registers[12],
      sp: registers[13],
      lr: registers[14],
      pc: registers[15],
      xPSR,
      MSP: core.readSpecialRegister(SYSM_MSP),
      PSP: core.readSpecialRegister(SYSM_PSP),
      PRIMASK: core.readSpecialRegister(SYSM_PRIMASK),
      CONTROL: core.readSpecialRegister(SYSM_CONTROL),

      N: !!(xPSR & 0x80000000),
      Z: !!(xPSR & 0x40000000),
      C: !!(xPSR & 0x20000000),
      V: !!(xPSR & 0x10000000),
    };
  }

  async readUint8(address: number) {
    return this.rp2040.readUint8(address);
  }

  async readUint16(address: number) {
    return this.rp2040.readUint16(address);
  }

  async readUint32(address: number) {
    return this.rp2040.readUint32(address) >>> 0;
  }

  async readInt32(address: number) {
    return this.rp2040.readUint32(address) | 0;
  }
}
