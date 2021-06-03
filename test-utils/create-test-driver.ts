import { RP2040 } from '../src';
import { GDBClient } from './gdbclient';
import { ICortexTestDriver } from './test-driver';
import { GDBTestDriver } from './test-driver-gdb';
import { RP2040TestDriver } from './test-driver-rp2040';

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
