import { RP2040 } from '../src/rp2040.js';
import { GDBClient } from './gdbclient.js';
import { GDBTestDriver } from './test-driver-gdb.js';
import { RP2040TestDriver } from './test-driver-rp2040.js';
import { ICortexTestDriver } from './test-driver.js';

export async function createTestDriver(): Promise<ICortexTestDriver> {
  if (process.env.TEST_GDB_SERVER) {
    const client = new GDBClient();
    await client.connect(process.env.TEST_GDB_SERVER);
    const cpu = new GDBTestDriver(client);
    await cpu.init();
    return cpu;
  } else {
    return new RP2040TestDriver(new RP2040());
  }
}
