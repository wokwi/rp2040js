import { RP2040, RAM_START_ADDRESS } from './rp2040';

const r4 = 4;
const r5 = 5;
const r6 = 6;

describe('RP2040', () => {
  describe('executeInstruction', () => {
    it('should execute a `push {r4, r5, r6, lr}` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0;
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
      rp2040.PC = 0;
      rp2040.flash16[0] = 0x2580; // movs r5, #128
      rp2040.executeInstruction();
      expect(rp2040.registers[r5]).toEqual(128);
      expect(rp2040.PC).toEqual(2);
    });

    it('should execute a `movs r6, r5` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0;
      rp2040.flash16[0] = 0x002e; // movs r6, r5
      rp2040.registers[r5] = 0x50;
      rp2040.executeInstruction();
      expect(rp2040.registers[r6]).toEqual(0x50);
    });

    it('should execute a `lsls r5, r5, #18` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0;
      rp2040.flash16[0] = 0x04ad; // lsls r5, r5, #18
      rp2040.registers[r5] = 0b00000000000000000011;
      rp2040.executeInstruction();
      expect(rp2040.registers[5]).toEqual(0b11000000000000000000);
      expect(rp2040.PC).toEqual(2);
    });

    it('should execute a `str	r6, [r4, #20]` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 0;
      rp2040.flash16[0] = 0x6166; // str	r6, [r4, #20]
      rp2040.registers[r4] = RAM_START_ADDRESS + 0x20;
      rp2040.registers[r6] = 0xf00d;
      rp2040.executeInstruction();
      expect(rp2040.sramView.getUint32(0x20 + 20, true)).toEqual(0xf00d);
      expect(rp2040.PC).toEqual(2);
    });

    it('should execute a `b.n	.-20` instruction', () => {
      const rp2040 = new RP2040('');
      rp2040.PC = 9 * 2;
      rp2040.flash16[9] = 0xe7f6; // b.n	.-20
      rp2040.executeInstruction();
      expect(rp2040.PC).toEqual(2);
    });
  });
});
