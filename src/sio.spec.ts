import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDriver } from '../test-utils/create-test-driver';
import { ICortexTestDriver } from '../test-utils/test-driver';
import { SIO_START_ADDRESS } from './rp2040';

//Hardware Divider registers absolute address
const SIO_DIV_UDIVIDEND = SIO_START_ADDRESS + 0x060; //  Divider unsigned dividend
const SIO_DIV_UDIVISOR = SIO_START_ADDRESS + 0x064; //  Divider unsigned divisor
const SIO_DIV_SDIVIDEND = SIO_START_ADDRESS + 0x068; //  Divider signed dividend
const SIO_DIV_SDIVISOR = SIO_START_ADDRESS + 0x06c; //  Divider signed divisor
const SIO_DIV_QUOTIENT = SIO_START_ADDRESS + 0x070; //  Divider result quotient
const SIO_DIV_REMAINDER = SIO_START_ADDRESS + 0x074; //Divider result remainder
const SIO_DIV_CSR = SIO_START_ADDRESS + 0x078;

//SPINLOCK
const SIO_SPINLOCK10 = SIO_START_ADDRESS + 0x128;
const SIO_SPINLOCKST = SIO_START_ADDRESS + 0x5c;

describe('RPSIO', () => {
  let cpu: ICortexTestDriver;

  beforeEach(async () => {
    cpu = await createTestDriver();
  });

  afterEach(async () => {
    await cpu.tearDown();
  });

  describe('Hardware Divider', () => {
    it('should perform a signed hardware divider 123456 / -321 = -384 REM 192', async () => {
      await cpu.writeUint32(SIO_DIV_SDIVIDEND, 123456);
      expect(await cpu.readInt32(SIO_DIV_SDIVIDEND)).toEqual(123456);
      await cpu.writeUint32(SIO_DIV_SDIVISOR, -321);
      expect(await cpu.readUint32(SIO_DIV_CSR)).toEqual(3);
      expect(await cpu.readInt32(SIO_DIV_SDIVISOR)).toEqual(-321);
      expect(await cpu.readInt32(SIO_DIV_REMAINDER)).toEqual(192);
      expect(await cpu.readInt32(SIO_DIV_QUOTIENT)).toEqual(-384);
      expect(await cpu.readUint32(SIO_DIV_CSR)).toEqual(1);
    });

    it('should perform a signed hardware divider -3000 / 2 = -1500 REM 0', async () => {
      await cpu.writeUint32(SIO_DIV_SDIVIDEND, -3000);
      expect(await cpu.readInt32(SIO_DIV_SDIVIDEND)).toEqual(-3000);
      await cpu.writeUint32(SIO_DIV_SDIVISOR, 2);
      expect(await cpu.readUint32(SIO_DIV_CSR)).toEqual(3);
      expect(await cpu.readInt32(SIO_DIV_SDIVISOR)).toEqual(2);
      expect(await cpu.readInt32(SIO_DIV_REMAINDER)).toEqual(0);
      expect(await cpu.readInt32(SIO_DIV_QUOTIENT)).toEqual(-1500);
      expect(await cpu.readUint32(SIO_DIV_CSR)).toEqual(1);
    });

    it('should perform an unsigned hardware divider 123456 / 321 = 384 REM 192', async () => {
      await cpu.writeUint32(SIO_DIV_UDIVIDEND, 123456);
      await cpu.writeUint32(SIO_DIV_UDIVISOR, 321);
      expect(await cpu.readUint32(SIO_DIV_CSR)).toEqual(3);
      expect(await cpu.readUint32(SIO_DIV_REMAINDER)).toEqual(192);
      expect(await cpu.readUint32(SIO_DIV_QUOTIENT)).toEqual(384);
      expect(await cpu.readUint32(SIO_DIV_CSR)).toEqual(1);
    });

    it('should perform a division, store the result, do another division then restore the previously stored result ', async () => {
      await cpu.writeUint32(SIO_DIV_SDIVIDEND, 123456);
      await cpu.writeUint32(SIO_DIV_SDIVISOR, -321);
      const remainder = await cpu.readInt32(SIO_DIV_REMAINDER);
      const quotient = await cpu.readInt32(SIO_DIV_QUOTIENT);
      expect(remainder).toEqual(192);
      expect(quotient).toEqual(-384);
      await cpu.writeUint32(SIO_DIV_UDIVIDEND, 123);
      await cpu.writeUint32(SIO_DIV_UDIVISOR, 7);
      expect(await cpu.readUint32(SIO_DIV_REMAINDER)).toEqual(4);
      expect(await cpu.readUint32(SIO_DIV_QUOTIENT)).toEqual(17);
      await cpu.writeUint32(SIO_DIV_REMAINDER, remainder);
      await cpu.writeUint32(SIO_DIV_QUOTIENT, quotient);
      expect(await cpu.readUint32(SIO_DIV_CSR)).toEqual(3);
      expect(await cpu.readInt32(SIO_DIV_REMAINDER)).toEqual(192);
      expect(await cpu.readInt32(SIO_DIV_QUOTIENT)).toEqual(-384);
    });

    it('should perform an unsigned division by zero 123456 / 0 = 0xffffffff REM 123456', async () => {
      await cpu.writeUint32(SIO_DIV_UDIVIDEND, 123456);
      await cpu.writeUint32(SIO_DIV_UDIVISOR, 0);
      expect(await cpu.readUint32(SIO_DIV_REMAINDER)).toEqual(123456);
      expect(await cpu.readUint32(SIO_DIV_QUOTIENT)).toEqual(0xffffffff);
    });

    it('should perform an unsigned division by zero 0x80000000 / 0 = 0xffffffff REM 0x80000000', async () => {
      await cpu.writeUint32(SIO_DIV_UDIVIDEND, 0x80000000);
      await cpu.writeUint32(SIO_DIV_UDIVISOR, 0);
      expect(await cpu.readUint32(SIO_DIV_REMAINDER)).toEqual(0x80000000);
      expect(await cpu.readUint32(SIO_DIV_QUOTIENT)).toEqual(0xffffffff);
    });

    it('should perform a signed division by zero 3000 / 0 = -1 REM 3000', async () => {
      await cpu.writeUint32(SIO_DIV_SDIVIDEND, 3000);
      await cpu.writeUint32(SIO_DIV_SDIVISOR, 0);
      expect(await cpu.readInt32(SIO_DIV_REMAINDER)).toEqual(3000);
      expect(await cpu.readInt32(SIO_DIV_QUOTIENT)).toEqual(-1);
    });

    it('should perform a signed division by zero -3000 / 0 = 1 REM -3000', async () => {
      await cpu.writeUint32(SIO_DIV_SDIVIDEND, -3000);
      await cpu.writeUint32(SIO_DIV_SDIVISOR, 0);
      expect(await cpu.readInt32(SIO_DIV_REMAINDER)).toEqual(-3000);
      expect(await cpu.readInt32(SIO_DIV_QUOTIENT)).toEqual(1);
    });

    it('should perform a signed division 0x80000000 / 2 = 0xc0000000 REM 0', async () => {
      await cpu.writeUint32(SIO_DIV_SDIVIDEND, 0x80000000);
      await cpu.writeUint32(SIO_DIV_SDIVISOR, 2);
      expect(await cpu.readUint32(SIO_DIV_REMAINDER)).toEqual(0);
      expect(await cpu.readUint32(SIO_DIV_QUOTIENT)).toEqual(0xc0000000);
    });

    it('should perform an unsigned division 0x80000000 / 2 = 0x40000000 REM 0', async () => {
      await cpu.writeUint32(SIO_DIV_UDIVIDEND, 0x80000000);
      await cpu.writeUint32(SIO_DIV_UDIVISOR, 2);
      expect(await cpu.readUint32(SIO_DIV_REMAINDER)).toEqual(0);
      expect(await cpu.readUint32(SIO_DIV_QUOTIENT)).toEqual(0x40000000);
    });
  });

  it('should unlock, lock and check lock status of spinlock10', async () => {
    await cpu.writeUint32(SIO_SPINLOCK10, 0x00000001); //ensure the spinlock is released
    expect(await cpu.readUint32(SIO_SPINLOCK10)).toEqual(1024); // lock spinlock, return 1<<spinlock num if previously unlocked
    expect(await cpu.readUint32(SIO_SPINLOCKST)).toEqual(1024); //bit mask of all spinlocks, locked=1<<spinlock
    expect(await cpu.readUint32(SIO_SPINLOCK10)).toEqual(0); //0=already locked
    expect(await cpu.readUint32(SIO_SPINLOCKST)).toEqual(1024);
    await cpu.writeUint32(SIO_SPINLOCK10, 0x00000001); //release the spinlock
    expect(await cpu.readUint32(SIO_SPINLOCKST)).toEqual(0);
  });
});
