import { RP2040 } from './rp2040';
import { opcodeBX, opcodeMOVS, opcodePOP, opcodePUSH } from './utils/assembler';

const r0 = 0;
const r4 = 4;
const lr = 14;

const VTOR = 0xe000ed08;

describe('RP2040', () => {
  it(`should initialize PC and SP according to bootrom's vector table`, () => {
    const rp2040 = new RP2040();
    rp2040.loadBootrom(new Uint32Array([0x20041f00, 0xee]));
    expect(rp2040.SP).toEqual(0x20041f00);
    expect(rp2040.PC).toEqual(0xee);
  });

  describe('IO Register Writes', () => {
    it('should replicate 8-bit values four times', () => {
      const rp2040 = new RP2040();
      const writeUint32 = jest.fn();
      rp2040.peripherals[0x10] = { writeUint32, readUint32: jest.fn() };
      rp2040.writeUint8(0x10123, 0x534);
      expect(writeUint32).toHaveBeenCalledWith(0x120, 0x34343434);
    });

    it('should replicate 16-bit values twice', () => {
      const rp2040 = new RP2040();
      const writeUint32 = jest.fn();
      rp2040.peripherals[0x10] = { writeUint32, readUint32: jest.fn() };
      rp2040.writeUint16(0x10123, 0x12345678);
      expect(writeUint32).toHaveBeenCalledWith(0x120, 0x56785678);
    });

    it('should support atomic I/O register write addresses', () => {
      const rp2040 = new RP2040();
      const writeUint32 = jest.fn();
      rp2040.peripherals[0x10] = { writeUint32, readUint32: jest.fn() };
      rp2040.writeUint32(0x11120, 0x123);
      expect(writeUint32).toHaveBeenCalledWith(0x1120, 0x123);
    });
  });

  describe('exceptionEntry and exceptionReturn', () => {
    it('should execute an exception handler and return from it correctly', () => {
      const INT1 = 1 << 1;
      const INT1_HANDLER = 0x10000100;
      const EXC_INT1 = 16 + 1;
      const rp2040 = new RP2040();
      rp2040.SP = 0x20004000;
      rp2040.PC = 0x10004001;
      rp2040.registers[r0] = 0x44;
      rp2040.pendingInterrupts = INT1;
      rp2040.enabledInterrupts = INT1;
      rp2040.interruptsUpdated = true;
      rp2040.writeUint32(VTOR, 0x10000000);
      rp2040.writeUint32(0x10000000 + EXC_INT1 * 4, INT1_HANDLER);
      rp2040.writeUint16(INT1_HANDLER, opcodeMOVS(r0, 0x55));
      rp2040.writeUint16(INT1_HANDLER + 2, opcodeBX(lr));
      // Exception handler should start at this point.
      rp2040.executeInstruction(); // MOVS r0, 0x55
      expect(rp2040.IPSR).toEqual(EXC_INT1);
      expect(rp2040.PC).toEqual(INT1_HANDLER + 2);
      expect(rp2040.registers[r0]).toEqual(0x55);
      rp2040.executeInstruction(); // BX lr
      // Exception handler should return at this point.
      expect(rp2040.PC).toEqual(0x10004000);
      expect(rp2040.registers[r0]).toEqual(0x44);
      expect(rp2040.IPSR).toEqual(0);
    });

    it('should return correctly from exception with POP {lr}', () => {
      const INT1 = 1 << 1;
      const INT1_HANDLER = 0x10000100;
      const EXC_INT1 = 16 + 1;
      const rp2040 = new RP2040();
      rp2040.SP = 0x20004000;
      rp2040.PC = 0x10004001;
      rp2040.registers[r4] = 105;
      rp2040.pendingInterrupts = INT1;
      rp2040.enabledInterrupts = INT1;
      rp2040.interruptsUpdated = true;
      rp2040.writeUint32(VTOR, 0x10000000);
      rp2040.writeUint32(0x10000000 + EXC_INT1 * 4, INT1_HANDLER);
      rp2040.writeUint16(INT1_HANDLER, opcodePUSH(true, 0b01110000));
      rp2040.writeUint16(INT1_HANDLER + 2, opcodeMOVS(r4, 42));
      rp2040.writeUint16(INT1_HANDLER + 4, opcodePOP(true, 0b01110000));
      // Exception handler should start at this point.
      rp2040.executeInstruction(); // push {r4, r5, r6, lr}
      expect(rp2040.IPSR).toEqual(EXC_INT1);
      expect(rp2040.PC).toEqual(INT1_HANDLER + 2);
      rp2040.executeInstruction(); // mov r4, 42
      expect(rp2040.registers[r4]).toEqual(42);
      rp2040.executeInstruction(); // pop {r4, r5, r6, pc}
      // Exception handler should return at this point.
      expect(rp2040.PC).toEqual(0x10004000);
      expect(rp2040.registers[r4]).toEqual(105);
      expect(rp2040.IPSR).toEqual(0);
    });
  });

  describe('NVIC registers', () => {
    it('writing to NVIC_ISPR should set the corresponding pending interrupt bits', () => {
      const rp2040 = new RP2040();
      rp2040.pendingInterrupts = 0x1;
      rp2040.writeUint32(0xe000e200, 0x10);
      expect(rp2040.pendingInterrupts).toBe(0x11);
    });

    it('writing to NVIC_ICPR should clear corresponding pending interrupt bits', () => {
      const rp2040 = new RP2040();
      rp2040.pendingInterrupts = 0xff;
      rp2040.writeUint32(0xe000e280, 0x10);
      expect(rp2040.pendingInterrupts).toBe(0xef);
    });

    it('writing to NVIC_ISER should set the corresponding enabled interrupt bits', () => {
      const rp2040 = new RP2040();
      rp2040.enabledInterrupts = 0x1;
      rp2040.writeUint32(0xe000e100, 0x10);
      expect(rp2040.enabledInterrupts).toBe(0x11);
    });

    it('writing to NVIC_ICER should clear corresponding enabled interrupt bits', () => {
      const rp2040 = new RP2040();
      rp2040.enabledInterrupts = 0xff;
      rp2040.writeUint32(0xe000e180, 0x10);
      expect(rp2040.enabledInterrupts).toBe(0xef);
    });

    it('reading from NVIC_ISER/NVIC_ICER should return the current enabled interrupt bits', () => {
      const rp2040 = new RP2040();
      rp2040.enabledInterrupts = 0x1;
      expect(rp2040.readUint32(0xe000e100)).toEqual(0x1);
      expect(rp2040.readUint32(0xe000e180)).toEqual(0x1);
    });

    it('reading from NVIC_ISPR/NVIC_ICPR should return the current enabled interrupt bits', () => {
      const rp2040 = new RP2040();
      rp2040.pendingInterrupts = 0x2;
      expect(rp2040.readUint32(0xe000e200)).toEqual(0x2);
      expect(rp2040.readUint32(0xe000e280)).toEqual(0x2);
    });

    it('should update the interrupt levels correctly when writing to NVIC_IPR3', () => {
      const rp2040 = new RP2040();
      // Set the priority of interrupt number 14 to 2
      rp2040.writeUint32(0xe000e40c, 0x00800000);
      expect(rp2040.interruptPriorities[0] | 0).toEqual(~(1 << 14));
      expect(rp2040.interruptPriorities[1]).toEqual(0);
      expect(rp2040.interruptPriorities[2]).toEqual(1 << 14);
      expect(rp2040.interruptPriorities[3]).toEqual(0);
      expect(rp2040.readUint32(0xe000e40c)).toEqual(0x00800000);
    });

    it('should return the correct interrupt priorities when reading from NVIC_IPR5', () => {
      const rp2040 = new RP2040();
      rp2040.interruptPriorities[0] = 0;
      rp2040.interruptPriorities[1] = 0x001fffff; // interrupts 0 ... 20
      rp2040.interruptPriorities[2] = 0x00200000; // interrupt 21
      rp2040.interruptPriorities[3] = 0xffc00000; // interrupt 22 ... 31
      // Set the priority of interrupt number 14 to 2
      expect(rp2040.readUint32(0xe000e414)).toEqual(0xc0c08040 | 0);
    });
  });
});
