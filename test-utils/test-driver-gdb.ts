import { GDBClient } from './gdbclient';
import { ICortexRegisterName, ICortexRegisters, ICortexTestDriver } from './test-driver';

const pc = 15;

export class GDBTestDriver implements ICortexTestDriver {
  constructor(private readonly gdbClient: GDBClient) {}

  async init() {
    await this.gdbClient.monitor('reset init');
    await this.setRegisters({ C: false, Z: false, N: false, V: false });
  }

  async tearDown() {
    this.gdbClient.disconnect();
  }

  async setPC(pcValue: number) {
    await this.gdbClient.writeRegister(pc, pcValue);
  }

  async writeUint8(address: number, value: number) {
    await this.gdbClient.writeMemory(address, new Uint8Array([value]));
  }

  async writeUint16(address: number, value: number) {
    await this.gdbClient.writeMemory(address, new Uint8Array(new Uint16Array([value]).buffer));
  }

  async writeUint32(address: number, value: number) {
    await this.gdbClient.writeMemory(address, new Uint8Array(new Uint32Array([value]).buffer));
  }

  async setRegisters(registers: Partial<ICortexRegisters>) {
    const registerMap = {
      r0: 0,
      r1: 1,
      r2: 2,
      r3: 3,
      r4: 4,
      r5: 5,
      r6: 6,
      r7: 7,
      r8: 8,
      r9: 9,
      r10: 10,
      r11: 11,
      r12: 12,
      sp: 13,
      lr: 14,
      pc: 15,
      xPSR: 16,
      MSP: 17,
      PSP: 18,
      PRIMASK: 19,
      CONTROL: 22,
      N: null,
      Z: null,
      C: null,
      V: null,
    };
    const xSPR = registerMap.xPSR;
    let haveFlagRegisters = false;
    for (const key of Object.keys(registers) as ICortexRegisterName[]) {
      const registerIndex = registerMap[key];
      if (registerIndex != null) {
        const value = registers[key] as number;
        await this.gdbClient.writeRegister(registerIndex, value);
      } else {
        haveFlagRegisters = true;
      }
    }
    if (haveFlagRegisters) {
      let xPSRValue = await this.gdbClient.readRegister(xSPR);
      const flagBits = {
        N: 0x80000000,
        Z: 0x40000000,
        C: 0x20000000,
        V: 0x10000000,
      };
      for (const flag of Object.keys(flagBits) as (keyof typeof flagBits)[]) {
        if (flag in registers) {
          const flagBitMask = flagBits[flag];
          const flagValue = registers[flag];
          if (flagValue) {
            xPSRValue |= flagBitMask;
          } else {
            xPSRValue &= ~flagBitMask;
          }
        }
      }
      await this.gdbClient.writeRegister(xSPR, xPSRValue);
    }
  }

  async setRegister(index: number, value: number) {
    await this.gdbClient.writeRegister(index, value);
  }

  async singleStep() {
    await this.gdbClient.singleStep();
  }

  async readRegisters(): Promise<ICortexRegisters> {
    const registers = await this.gdbClient.readRegisters();
    const xPSR = registers[16];
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
      MSP: await this.gdbClient.readRegister(17),
      PSP: await this.gdbClient.readRegister(18),
      PRIMASK: await this.gdbClient.readRegister(19),
      CONTROL: await this.gdbClient.readRegister(22),

      N: !!(xPSR & 0x80000000),
      Z: !!(xPSR & 0x40000000),
      C: !!(xPSR & 0x20000000),
      V: !!(xPSR & 0x10000000),
    };
  }

  async readUint8(address: number) {
    const result = await this.gdbClient.readMemory(address, 1);
    return result[0];
  }

  async readUint16(address: number) {
    const result = await this.gdbClient.readMemory(address, 2);
    return new Uint16Array(result.buffer)[0];
  }

  async readUint32(address: number) {
    const result = await this.gdbClient.readMemory(address, 4);
    return new Uint32Array(result.buffer)[0];
  }

  async readInt32(address: number) {
    return (await this.readUint32(address)) | 0;
  }
}
