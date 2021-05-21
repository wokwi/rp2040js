import { RP2040, SIO_START_ADDRESS } from './rp2040';

//HARDWARE DIVIDER
const _DIV_UDIVIDEND = SIO_START_ADDRESS + 0x060; //  Divider unsigned dividend
const _DIV_UDIVISOR = SIO_START_ADDRESS + 0x064; //  Divider unsigned divisor
const _DIV_SDIVIDEND = SIO_START_ADDRESS + 0x068; //  Divider signed dividend
const _DIV_SDIVISOR = SIO_START_ADDRESS + 0x06c; //  Divider signed divisor
const _DIV_QUOTIENT = SIO_START_ADDRESS + 0x070; //  Divider result quotient
const _DIV_REMAINDER = SIO_START_ADDRESS + 0x074; //Divider result remainder
const _DIV_CSR = SIO_START_ADDRESS + 0x078;

describe('RPSIO', () => {
  describe('Hardware Divider', () => {
    it('should set perform a signed hardware divider 123456 / -321 = -384 R192', () => {
      const rp2040 = new RP2040();
      expect(rp2040.readUint32(_DIV_CSR)).toEqual(0);
      rp2040.writeUint32(_DIV_SDIVIDEND, 123456);
      rp2040.writeUint32(_DIV_SDIVISOR, -321);
      expect(rp2040.readUint32(_DIV_CSR)).toEqual(1);
      expect(rp2040.readUint32(_DIV_REMAINDER)).toEqual(192);
      expect(rp2040.readUint32(_DIV_QUOTIENT)).toEqual(-384);
      expect(rp2040.readUint32(_DIV_CSR)).toEqual(0);
    });

    it('should set perform an unsigned hardware divider -123456 / 321 = 384 R192', () => {
      const rp2040 = new RP2040();
      expect(rp2040.readUint32(_DIV_CSR)).toEqual(0);
      rp2040.writeUint32(_DIV_UDIVIDEND, 123456);
      const cycles = rp2040.cycles;
      rp2040.writeUint32(_DIV_UDIVISOR, 321);
      expect(rp2040.cycles - cycles).toEqual(8);
      expect(rp2040.readUint32(_DIV_CSR)).toEqual(1);
      expect(rp2040.readUint32(_DIV_REMAINDER)).toEqual(192);
      expect(rp2040.readUint32(_DIV_QUOTIENT)).toEqual(384);
      expect(rp2040.readUint32(_DIV_CSR)).toEqual(0);
    });

    it('should perform a division, store the result, do another division then restore the previously stored result ', () => {
      const rp2040 = new RP2040();
      rp2040.writeUint32(_DIV_SDIVIDEND, 123456);
      rp2040.writeUint32(_DIV_SDIVISOR, -321);
      const remainder = rp2040.readUint32(_DIV_REMAINDER);
      const quotient = rp2040.readUint32(_DIV_QUOTIENT);
      expect(remainder).toEqual(192);
      expect(quotient).toEqual(-384);
      rp2040.writeUint32(_DIV_UDIVIDEND, 123);
      rp2040.writeUint32(_DIV_UDIVISOR, 7);
      expect(rp2040.readUint32(_DIV_REMAINDER)).toEqual(4);
      expect(rp2040.readUint32(_DIV_QUOTIENT)).toEqual(17);
      rp2040.writeUint32(_DIV_REMAINDER, remainder);
      rp2040.writeUint32(_DIV_QUOTIENT, quotient);
      expect(rp2040.readUint32(_DIV_REMAINDER)).toEqual(192);
      expect(rp2040.readUint32(_DIV_QUOTIENT)).toEqual(-384);
    });

    it('should set perform an unsigned division by zero 123456 / 0 = Infinity RNaN', () => {
      const rp2040 = new RP2040();
      rp2040.writeUint32(_DIV_UDIVIDEND, 123456);
      rp2040.writeUint32(_DIV_UDIVISOR, 0);
      expect(rp2040.readUint32(_DIV_REMAINDER)).toEqual(NaN);
      expect(rp2040.readUint32(_DIV_QUOTIENT)).toEqual(Infinity);
    });
  });
});
