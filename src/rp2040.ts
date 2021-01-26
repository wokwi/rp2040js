// Run blink!

import { loadHex } from './intelhex';

export const RAM_START_ADDRESS = 0x20000000;
export const SIO_START_ADDRESS = 0xd0000000;

export class RP2040 {
  readonly sram = new Uint8Array(264 * 1024);
  readonly sramView = new DataView(this.sram.buffer);
  readonly flash = new Uint8Array(16 * 1024 * 1024);
  readonly flash16 = new Uint16Array(this.flash.buffer);
  readonly registers = new Uint32Array(16);

  constructor(hex: string) {
    this.SP = 0x20041000;
    this.flash.fill(0xff);
    loadHex(hex, this.flash);
  }

  get SP() {
    return this.registers[13];
  }

  set SP(value: number) {
    this.registers[13] = value;
  }

  get LR() {
    return this.registers[14];
  }

  set LR(value: number) {
    this.registers[14] = value;
  }

  get PC() {
    return this.registers[15];
  }

  set PC(value: number) {
    this.registers[15] = value;
  }

  writeUint32(address: number, value: number) {
    if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      this.sramView.setUint32(address - RAM_START_ADDRESS, value, true);
    }
    if (address >= SIO_START_ADDRESS && address < SIO_START_ADDRESS + 0x10000000) {
      const sioAddress = address - SIO_START_ADDRESS;
      // SIO write
      let pinList = [];
      for (let i = 0; i < 32; i++) {
        if (value & (1 << i)) {
          pinList.push(i);
        }
      }
      if (sioAddress === 20) {
        console.log(`GPIO pins ${pinList} set to HIGH`);
      } else if (sioAddress === 24) {
        console.log(`GPIO pins ${pinList} set to LOW`);
      } else {
        console.log('Someone wrote', value.toString(16), 'to', sioAddress);
      }
    }
  }

  executeInstruction() {
    // ARM Thumb instruction encoding - 16 bits / 2 bytes
    const opcode = this.flash16[this.PC / 2];
    const opcode2 = this.flash16[this.PC / 2 + 1];
    // B
    if (opcode >> 11 === 0b11100) {
      let imm11 = (opcode & 0x7ff) << 1;
      if (imm11 & (1 << 11)) {
        imm11 = (imm11 & 0x7ff) - 0x800;
      }
      this.PC += imm11 + 2;
    }
    // BL
    if (opcode >> 11 === 0b11110 && opcode2 >> 14 === 0b11) {
      // right now we just ignore it. but let's print it!
      console.log('BL ignored');
    }
    // LSLS
    else if (opcode >> 11 === 0b00000) {
      const imm5 = (opcode >> 6) & 0x1f;
      const Rm = (opcode >> 3) & 0x7;
      const Rd = opcode & 0x7;
      this.registers[Rd] = this.registers[Rm] << imm5;
      // update flags
      // APSR.N = result<31>;
      // APSR.Z = IsZeroBit(result);
      // APSR.C = carry;
      // APSR.V unchanged
    }
    // MOVS
    else if (opcode >> 11 === 0b00100) {
      const value = opcode & 0xff;
      const Rd = (opcode >> 8) & 7;
      this.registers[Rd] = value;
      // update status flags (if InITBlock)?
      // APSR.N = result<31>;
      // APSR.Z = IsZeroBit(result);
      // APSR.C = carry;
      // APSR.V unchanged
    }
    // PUSH
    else if (opcode >> 9 === 0b1011010) {
      let bitCount = 0;
      for (let i = 0; i <= 8; i++) {
        if (opcode & (1 << i)) {
          bitCount++;
        }
      }
      let address = this.SP - 4 * bitCount;
      for (let i = 0; i <= 7; i++) {
        if (opcode & (1 << i)) {
          this.writeUint32(address, this.registers[i]);
          address += 4;
        }
      }
      if (opcode & (1 << 8)) {
        this.writeUint32(address, this.registers[14]);
      }
      this.SP -= 4 * bitCount;
    }
    // STR (immediate)
    else if (opcode >> 11 === 0b01100) {
      const imm5 = ((opcode >> 6) & 0x1f) << 2;
      const Rn = (opcode >> 3) & 0x7;
      const Rt = opcode & 0x7;
      const address = this.registers[Rn] + imm5;
      this.writeUint32(address, this.registers[Rt]);
    }

    this.PC += 2;
  }
}
