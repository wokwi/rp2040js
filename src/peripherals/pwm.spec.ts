import { describe, expect, it } from 'vitest';
import { MockClock } from '../clock/mock-clock.js';
import { RP2040 } from '../rp2040.js';

const PWM_BASE = 0x40050000;
const CH0_CSR = PWM_BASE + 0x00;
const CH0_CTR = PWM_BASE + 0x08;

const ATOMIC_SET = 0x2000;

/* CH0_CSR bits */
const CSR_PH_ADV = 1 << 7;
const CSR_PH_RET = 1 << 6;
const CSR_EN = 1 << 0;

describe('RPPWM', () => {
  describe('PH_ADV / PH_RET', () => {
    it('should advance the counter by 1 when setting the PH_ADV bit', () => {
      const rp2040 = new RP2040(new MockClock());
      rp2040.writeUint32(CH0_CSR, CSR_EN);
      rp2040.writeUint32(CH0_CTR, 10);
      // pwm_advance_count() sets the bit through the atomic set alias
      rp2040.writeUint32(CH0_CSR | ATOMIC_SET, CSR_PH_ADV);
      expect(rp2040.readUint32(CH0_CTR)).toEqual(11);
    });

    it('should retard the counter by 1 when setting the PH_RET bit', () => {
      const rp2040 = new RP2040(new MockClock());
      rp2040.writeUint32(CH0_CSR, CSR_EN);
      rp2040.writeUint32(CH0_CTR, 10);
      rp2040.writeUint32(CH0_CSR | ATOMIC_SET, CSR_PH_RET);
      expect(rp2040.readUint32(CH0_CTR)).toEqual(9);
    });

    it('should self-clear the PH_ADV and PH_RET bits', () => {
      // pwm_advance_count() polls the bit until it reads back as zero
      const rp2040 = new RP2040(new MockClock());
      rp2040.writeUint32(CH0_CSR, CSR_EN | CSR_PH_ADV | CSR_PH_RET);
      expect(rp2040.readUint32(CH0_CSR) & (CSR_PH_ADV | CSR_PH_RET)).toEqual(0);
    });

    it('should wrap around to TOP when retarding the counter past zero', () => {
      const rp2040 = new RP2040(new MockClock());
      rp2040.writeUint32(CH0_CSR, CSR_EN);
      rp2040.writeUint32(CH0_CTR, 0);
      rp2040.writeUint32(CH0_CSR | ATOMIC_SET, CSR_PH_RET);
      expect(rp2040.readUint32(CH0_CTR)).toEqual(0xffff);
    });

    it('should not change the counter when the channel is not running', () => {
      // Both bits are documented as acting on a running counter
      const rp2040 = new RP2040(new MockClock());
      rp2040.writeUint32(CH0_CTR, 10);
      rp2040.writeUint32(CH0_CSR | ATOMIC_SET, CSR_PH_ADV);
      expect(rp2040.readUint32(CH0_CTR)).toEqual(10);
    });
  });
});
