import { RP2040, RAM_START_ADDRESS } from './rp2040';
import {
  opcodeADCS,
  opcodeADDS2,
  opcodeADR,
  opcodeBICS,
  opcodeBL,
  opcodeBLX,
  opcodeBX,
  opcodeLDMIA,
  opcodeLDRB,
  opcodeLDRH,
  opcodeLSRS,
  opcodePOP,
  opcodeRSBS,
  opcodeSTMIA,
  opcodeSUBS2,
  opcodeUXTB,
} from './utils/assembler';

const r0 = 0;
const r1 = 1;
const r2 = 2;
const r3 = 3;
const r4 = 4;
const r5 = 5;
const r6 = 6;
const r7 = 7;
const lr = 14;

describe('RP2040', () => {
  it(`should initialize PC and SP according to bootrom's vector table`, () => {
    const rp2040 = new RP2040('');
    expect(rp2040.SP).toEqual(0x20041f00);
    expect(rp2040.PC).toEqual(0xee);
  });

  describe('executeInstruction', () => {
    it('should execute `adcs r5, r4` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeADCS(r5, r4);
      rp2040.registers[r4] = 55;
      rp2040.registers[r5] = 66;
      rp2040.C = true;
      rp2040.executeInstruction();
      expect(rp2040.registers[r5]).toEqual(122);
      expect(rp2040.N).toEqual(false);
      expect(rp2040.Z).toEqual(false);
      expect(rp2040.C).toEqual(false);
      expect(rp2040.V).toEqual(false);
    });

    it('should execute `adcs r5, r4` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeADCS(r5, r4);
      rp2040.registers[r4] = 0x7fffffff; // Max signed INT32
      rp2040.registers[r5] = 0;
      rp2040.C = true;
      rp2040.executeInstruction();
      expect(rp2040.registers[r5]).toEqual(0x80000000);
      expect(rp2040.N).toEqual(true);
      expect(rp2040.Z).toEqual(false);
      expect(rp2040.C).toEqual(false);
      expect(rp2040.V).toEqual(true);
    });

    it('should execute `adds r1, #1` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeADDS2(r1, 1);
      rp2040.registers[r1] = 0xffffffff;
      rp2040.executeInstruction();
      expect(rp2040.registers[r1]).toEqual(0);
      expect(rp2040.N).toEqual(false);
      expect(rp2040.Z).toEqual(true);
      expect(rp2040.C).toEqual(true);
      expect(rp2040.V).toEqual(false);
    });

    it('should execute `adr r4, #0x50` instruction and set the overflow flag correctly', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeADR(r4, 0x50);
      rp2040.executeInstruction();
      expect(rp2040.registers[r4]).toEqual(0x10000054);
    });

    it('should execute `bics r0, r3` correctly', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.registers[r0] = 0xff;
      rp2040.registers[r3] = 0x0f;
      rp2040.flash16[0] = opcodeBICS(r0, r3);
      rp2040.executeInstruction();
      expect(rp2040.registers[r0]).toEqual(0xf0);
      expect(rp2040.N).toEqual(false);
      expect(rp2040.Z).toEqual(false);
    });

    it('should execute `bics r0, r3` instruction and set the negative flag correctly', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.registers[r0] = 0xffffffff;
      rp2040.registers[r3] = 0x0000ffff;
      rp2040.flash16[0] = opcodeBICS(r0, r3);
      rp2040.executeInstruction();
      expect(rp2040.registers[r0]).toEqual(0xffff0000);
      expect(rp2040.N).toEqual(true);
      expect(rp2040.Z).toEqual(false);
    });

    it('should execute `bl 0x34` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      console.log(opcodeBL(0x34).toString(16));
      rp2040.flashView.setUint32(0, opcodeBL(0x34), true);
      rp2040.executeInstruction();
      expect(rp2040.PC).toEqual(0x10000038);
      expect(rp2040.LR).toEqual(0x10000004);
    });

    it('should execute `bl -0x10` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flashView.setUint32(0, opcodeBL(-0x10), true);
      rp2040.executeInstruction();
      expect(rp2040.PC).toEqual(0x10000004 - 0x10);
      expect(rp2040.LR).toEqual(0x10000004);
    });

    it('should execute `blx r3` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.registers[3] = 0x10000201;
      rp2040.flashView.setUint32(0, opcodeBLX(r3), true);
      rp2040.executeInstruction();
      expect(rp2040.PC).toEqual(0x10000200);
      expect(rp2040.LR).toEqual(0x10000002);
    });

    it('should execute a `b.n	.-20` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000 + 9 * 2;
      rp2040.flash16[9] = 0xe7f6; // b.n	.-20
      rp2040.executeInstruction();
      expect(rp2040.PC).toEqual(0x10000002);
    });

    it('should execute a `bne.n .-6` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000 + 9 * 2;
      rp2040.Z = false;
      rp2040.flash16[9] = 0xd1fc; // bne.n .-6
      rp2040.executeInstruction();
      expect(rp2040.PC).toEqual(0x1000000e);
    });

    it('should execute `bx lr` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.LR = 0x10000200;
      rp2040.flashView.setUint32(0, opcodeBX(lr), true);
      rp2040.executeInstruction();
      expect(rp2040.PC).toEqual(0x10000200);
    });

    it('should execute an `cmp r5, #66` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = 0x2d42; // cmp r5, #66
      rp2040.registers[r5] = 60;
      rp2040.executeInstruction();
      expect(rp2040.N).toEqual(true);
      expect(rp2040.Z).toEqual(false);
      expect(rp2040.C).toEqual(false);
      expect(rp2040.V).toEqual(false);
    });

    it('should execute an `cmp r5, r0` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = 0x4285; // cmp r5, r0
      rp2040.registers[r5] = 60;
      rp2040.registers[r0] = 56;
      rp2040.executeInstruction();
      expect(rp2040.N).toEqual(false);
      expect(rp2040.Z).toEqual(false);
      expect(rp2040.C).toEqual(true);
      expect(rp2040.V).toEqual(false);
    });

    it('should execute a `pop pc, {r4, r5, r6}` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.SP = RAM_START_ADDRESS + 0xf0;
      rp2040.flash16[0] = opcodePOP(true, (1 << r4) | (1 << r5) | (1 << r6));
      rp2040.sram[0xf0] = 0x40;
      rp2040.sram[0xf4] = 0x50;
      rp2040.sram[0xf8] = 0x60;
      rp2040.sram[0xfc] = 0x42;
      rp2040.executeInstruction();
      expect(rp2040.SP).toEqual(RAM_START_ADDRESS + 0x100);
      // assert that the values of r4, r5, r6, pc were poped from the stack correctly
      expect(rp2040.registers[r4]).toEqual(0x40);
      expect(rp2040.registers[r5]).toEqual(0x50);
      expect(rp2040.registers[r6]).toEqual(0x60);
      expect(rp2040.PC).toEqual(0x42);
    });

    it('should execute a `push {r4, r5, r6, lr}` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.SP = RAM_START_ADDRESS + 0x100;
      rp2040.flash16[0] = 0xb570; // push	{r4, r5, r6, lr}
      rp2040.registers[r4] = 0x40;
      rp2040.registers[r5] = 0x50;
      rp2040.registers[r6] = 0x60;
      rp2040.LR = 0x42;
      rp2040.executeInstruction();
      // assert that the values of r4, r5, r6, lr were pushed into the stack
      expect(rp2040.SP).toEqual(RAM_START_ADDRESS + 0xf0);
      expect(rp2040.sram[0xf0]).toEqual(0x40);
      expect(rp2040.sram[0xf4]).toEqual(0x50);
      expect(rp2040.sram[0xf8]).toEqual(0x60);
      expect(rp2040.sram[0xfc]).toEqual(0x42);
    });

    it('should execute a `movs r5, #128` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = 0x2580; // movs r5, #128
      rp2040.executeInstruction();
      expect(rp2040.registers[r5]).toEqual(128);
      expect(rp2040.PC).toEqual(0x10000002);
    });

    it('should execute a `ldmia r0!, {r1, r2}` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeLDMIA(r0, (1 << r1) | (1 << r2));
      rp2040.registers[r0] = 0x20000000;
      rp2040.sramView.setUint32(0, 0xf00df00d, true);
      rp2040.sramView.setUint32(4, 0x4242, true);
      rp2040.executeInstruction();
      expect(rp2040.PC).toEqual(0x10000002);
      expect(rp2040.registers[r0]).toEqual(0x20000008);
      expect(rp2040.registers[r1]).toEqual(0xf00df00d);
      expect(rp2040.registers[r2]).toEqual(0x4242);
    });

    it('should execute a `ldmia r5!, {r5}` instruction without writing back the address to r5', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeLDMIA(r5, 1 << r5);
      rp2040.registers[r5] = 0x20000000;
      rp2040.sramView.setUint32(0, 0xf00df00d, true);
      rp2040.executeInstruction();
      expect(rp2040.PC).toEqual(0x10000002);
      expect(rp2040.registers[r5]).toEqual(0xf00df00d);
    });

    it('should execute an `ldr r0, [pc, #148]` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = 0x4825; // ldr r0, [pc, #148]
      rp2040.flash[152] = 0x42;
      rp2040.flash.fill(0, 153, 156);
      rp2040.executeInstruction();
      expect(rp2040.registers[r0]).toEqual(0x42);
      expect(rp2040.PC).toEqual(0x10000002);
    });

    it('should execute an `ldr r3, [r2, #24]` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = 0x6993; // ldr r3, [r2, #24]
      rp2040.registers[r2] = 0x20000000;
      rp2040.sram[24] = 0x55;
      rp2040.executeInstruction();
      expect(rp2040.registers[r3]).toEqual(0x55);
    });

    it('should execute an `ldrb r4, [r2, 5]` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeLDRB(r4, r2, 5);
      rp2040.registers[r2] = 0x20000000;
      rp2040.sram[5] = 0x66;
      rp2040.sram[6] = 0x77;
      rp2040.executeInstruction();
      expect(rp2040.registers[r4]).toEqual(0x66);
    });

    it('should execute an `ldrh r3, [r7, #4]` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeLDRH(r3, r7, 4);
      rp2040.registers[r7] = 0x20000000;
      rp2040.sram[4] = 0x66;
      rp2040.sram[5] = 0x77;
      rp2040.sram[6] = 0xff;
      rp2040.sram[7] = 0xff;
      rp2040.executeInstruction();
      expect(rp2040.registers[r3]).toEqual(0x7766);
    });

    it('should execute an `ldrsh r5, [r3, r5]` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = 0x5f5d; // ldrsh r5, [r3, r5]
      rp2040.registers[r3] = 0x20000000;
      rp2040.registers[r5] = 6;
      rp2040.sram[6] = 0x55;
      rp2040.sram[7] = 0xf0;
      rp2040.executeInstruction();
      expect(rp2040.registers[r5]).toEqual(0x80007055);
    });

    it('should execute a `lsls r5, r5, #18` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = 0x04ad; // lsls r5, r5, #18
      rp2040.registers[r5] = 0b00000000000000000011;
      rp2040.executeInstruction();
      expect(rp2040.registers[r5]).toEqual(0b11000000000000000000);
      expect(rp2040.PC).toEqual(0x10000002);
      expect(rp2040.C).toEqual(false);
    });

    it('should execute a `lsls r5, r5, #18` instruction with carry', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = 0x04ad; // lsls r5, r5, #18
      rp2040.registers[r5] = 0x00004001;
      rp2040.executeInstruction();
      expect(rp2040.registers[r5]).toEqual(0x40000);
      expect(rp2040.C).toEqual(true);
    });

    it('should execute a `lsrs r1, r1, #1` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeLSRS(r1, r1, 1);
      rp2040.registers[r1] = 0b10;
      rp2040.executeInstruction();
      expect(rp2040.registers[r1]).toEqual(0b1);
      expect(rp2040.PC).toEqual(0x10000002);
      expect(rp2040.C).toEqual(false);
    });

    it('should execute a `lsrs r1, r1, 0` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeLSRS(r1, r1, 0);
      rp2040.registers[r1] = 0xffffffff;
      rp2040.executeInstruction();
      expect(rp2040.registers[r1]).toEqual(0);
      expect(rp2040.PC).toEqual(0x10000002);
      expect(rp2040.C).toEqual(true);
    });

    it('should execute a `movs r6, r5` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = 0x002e; // movs r6, r5
      rp2040.registers[r5] = 0x50;
      rp2040.executeInstruction();
      expect(rp2040.registers[r6]).toEqual(0x50);
    });

    it('should execute a `rsbs r0, r3` instruction', () => {
      // This instruction is also called `negs`
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeRSBS(r0, r3);
      rp2040.registers[r3] = 100;
      rp2040.executeInstruction();
      expect(rp2040.registers[r0] | 0).toEqual(-100);
      expect(rp2040.N).toEqual(true);
      expect(rp2040.Z).toEqual(false);
      expect(rp2040.C).toEqual(false);
      expect(rp2040.V).toEqual(false);
    });

    it('should execute a `sdmia r0!, {r1, r2}` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeSTMIA(r0, (1 << r1) | (1 << r2));
      rp2040.registers[r0] = 0x20000000;
      rp2040.registers[r1] = 0xf00df00d;
      rp2040.registers[r2] = 0x4242;
      rp2040.executeInstruction();
      expect(rp2040.PC).toEqual(0x10000002);
      expect(rp2040.registers[r0]).toEqual(0x20000008);
      expect(rp2040.sramView.getUint32(0, true)).toEqual(0xf00df00d);
      expect(rp2040.sramView.getUint32(4, true)).toEqual(0x4242);
    });

    it('should execute a `str	r6, [r4, #20]` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = 0x6166; // str	r6, [r4, #20]
      rp2040.registers[r4] = RAM_START_ADDRESS + 0x20;
      rp2040.registers[r6] = 0xf00d;
      rp2040.executeInstruction();
      expect(rp2040.sramView.getUint32(0x20 + 20, true)).toEqual(0xf00d);
      expect(rp2040.PC).toEqual(0x10000002);
    });

    it('should execute a `subs r5, #10` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeSUBS2(r5, 10);
      rp2040.registers[r5] = 100;
      rp2040.executeInstruction();
      expect(rp2040.registers[r5]).toEqual(90);
      expect(rp2040.N).toEqual(false);
      expect(rp2040.Z).toEqual(false);
      expect(rp2040.C).toEqual(true);
      expect(rp2040.V).toEqual(false);
    });

    it('should execute a `subs r1, #1` instruction with overflow', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeSUBS2(r1, 1);
      rp2040.registers[r1] = -0x80000000;
      rp2040.executeInstruction();
      expect(rp2040.registers[r1]).toEqual(0x7fffffff);
      expect(rp2040.N).toEqual(false);
      expect(rp2040.Z).toEqual(false);
      expect(rp2040.C).toEqual(true);
      expect(rp2040.V).toEqual(true);
    });

    it('should execute an `tst r1, r3` instruction when the result is negative', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = 0x4219; // tst r1, r3
      rp2040.registers[r1] = 0xf0000000;
      rp2040.registers[r3] = 0xf0004000;
      rp2040.sram[24] = 0x55;
      rp2040.executeInstruction();
      expect(rp2040.N).toEqual(true);
    });

    it('should execute an `tst r1, r3` instruction the registers are equal', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = 0x4219; // tst r1, r3
      rp2040.registers[r1] = 0;
      rp2040.registers[r3] = 55;
      rp2040.sram[24] = 0x55;
      rp2040.executeInstruction();
      expect(rp2040.Z).toEqual(true);
    });

    it('should execute an `uxtb	r5, r3` instruction the registers are equal', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0x10000000;
      rp2040.flash16[0] = opcodeUXTB(r5, r3);
      rp2040.registers[r3] = 0x12345678;
      rp2040.executeInstruction();
      expect(rp2040.registers[r5]).toEqual(0x78);
    });
  });
});
