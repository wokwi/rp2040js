import { RP2040, SIO_START_ADDRESS } from './rp2040';

import { GDBClient } from './utils/gdbclient';
import { ICortexTestDriver } from './utils/test-driver';
import { GDBTestDriver } from './utils/test-driver-gdb';
import { RP2040TestDriver } from './utils/test-driver-rp2040';

//HARDWARE DIVIDER
const SIO_DIV_UDIVIDEND = SIO_START_ADDRESS + 0x060; //  Divider unsigned dividend
const SIO_DIV_UDIVISOR = SIO_START_ADDRESS + 0x064; //  Divider unsigned divisor
const SIO_DIV_SDIVIDEND = SIO_START_ADDRESS + 0x068; //  Divider signed dividend
const SIO_DIV_SDIVISOR = SIO_START_ADDRESS + 0x06c; //  Divider signed divisor
const SIO_DIV_QUOTIENT = SIO_START_ADDRESS + 0x070; //  Divider result quotient
const SIO_DIV_REMAINDER = SIO_START_ADDRESS + 0x074; //Divider result remainder
const SIO_DIV_CSR = SIO_START_ADDRESS + 0x078;

describe('RPSIO', () => {
  let cpu: ICortexTestDriver;

  beforeEach(async () => {
    // if (process.env.TEST_GDB_SERVER) {
    if (false) {
      const client = new GDBClient();
      await client.connect('127.0.0.1');
      cpu = new GDBTestDriver(client);
      await cpu.init();
    } else {
      cpu = new RP2040TestDriver(new RP2040());
    }
  });

  afterEach(async () => {
    await cpu.tearDown();
  });

  describe('Hardware Divider', () => {
    it('should set perform a signed hardware divider 123456 / -321 = -384 R192', async () => {
      await cpu.writeUint32(SIO_DIV_SDIVIDEND, 123456);
      expect(await cpu.readUint32(SIO_DIV_SDIVIDEND)).toEqual(123456);
      await cpu.writeUint32(SIO_DIV_SDIVISOR, -321);
      expect(await cpu.readUint32(SIO_DIV_CSR)).toEqual(3);
      expect((await cpu.readUint32(SIO_DIV_SDIVISOR)) | 0).toEqual(-321);
      expect((await cpu.readUint32(SIO_DIV_REMAINDER)) | 0).toEqual(192);
      expect((await cpu.readUint32(SIO_DIV_QUOTIENT)) | 0).toEqual(-384);
      expect(await cpu.readUint32(SIO_DIV_CSR)).toEqual(1);
    });

    it('should set perform an unsigned hardware divider 123456 / 321 = 384 R192', async () => {
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
      const remainder = (await cpu.readUint32(SIO_DIV_REMAINDER)) | 0;
      const quotient = (await cpu.readUint32(SIO_DIV_QUOTIENT)) | 0;
      expect(remainder).toEqual(192);
      expect(quotient).toEqual(-384);
      await cpu.writeUint32(SIO_DIV_UDIVIDEND, 123);
      await cpu.writeUint32(SIO_DIV_UDIVISOR, 7);
      expect(await cpu.readUint32(SIO_DIV_REMAINDER)).toEqual(4);
      expect(await cpu.readUint32(SIO_DIV_QUOTIENT)).toEqual(17);
      await cpu.writeUint32(SIO_DIV_REMAINDER, remainder);
      await cpu.writeUint32(SIO_DIV_QUOTIENT, quotient);
      expect(await cpu.readUint32(SIO_DIV_CSR)).toEqual(3);
      expect((await cpu.readUint32(SIO_DIV_REMAINDER)) | 0).toEqual(192);
      expect((await cpu.readUint32(SIO_DIV_QUOTIENT)) | 0).toEqual(-384);
    });

    it('should set perform an unsigned division by zero 123456 / 0 = Infinity RNaN', async () => {
      await cpu.writeUint32(SIO_DIV_UDIVIDEND, 123456);
      await cpu.writeUint32(SIO_DIV_UDIVISOR, 0);
      expect(await cpu.readUint32(SIO_DIV_REMAINDER)).toEqual(123456);
      expect(await cpu.readUint32(SIO_DIV_QUOTIENT)).toEqual(0xffffffff);
    });
  });
});
