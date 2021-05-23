export interface ICortexRegisters {
  r0: number;
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  r5: number;
  r6: number;
  r7: number;
  r8: number;
  r9: number;
  r10: number;
  r11: number;
  r12: number;
  sp: number;
  lr: number;
  pc: number;
  xPSR: number;
  MSP: number;
  PSP: number;
  PRIMASK: number;
  CONTROL: number;

  N: boolean;
  Z: boolean;
  C: boolean;
  V: boolean;
}

export type ICortexRegisterName = keyof ICortexRegisters;

export interface ICortexTestDriver {
  init(): Promise<void>;
  setPC(pcValue: number): Promise<void>;
  writeUint8(address: number, value: number): Promise<void>;
  writeUint16(address: number, value: number): Promise<void>;
  writeUint32(address: number, value: number): Promise<void>;
  setRegisters(registers: Partial<ICortexRegisters>): Promise<void>;
  singleStep(): Promise<void>;
  readRegisters(): Promise<ICortexRegisters>;
  readUint8(address: number): Promise<number>;
  readUint16(address: number): Promise<number>;
  readUint32(address: number): Promise<number>;
  readInt32(address: number): Promise<number>;
  tearDown(): Promise<void>;
}
