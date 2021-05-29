import * as fs from 'fs';
import { RP2040 } from '../src';
import { bootromB1 } from './bootrom';
import { loadHex } from './intelhex';
import { GDBTCPServer } from '../src';
import { LogLevel } from '../src/utils/logging';

// Create an array with the compiled code of blink
// Execute the instructions from this array, one by one.
const hex = fs.readFileSync('micropython.hex', 'utf-8');
const mcu = new RP2040();
mcu.loadBootrom(bootromB1);
mcu.logger.currentLogLevel = LogLevel.Error;
loadHex(hex, mcu.flash, 0x10000000);

const gdbServer = new GDBTCPServer(mcu, 3333);
console.log(`RP2040 GDB Server ready! Listening on port ${gdbServer.port}`);

mcu.uart[0].onByte = (value) => {
  process.stdout.write(new Uint8Array([value]));
};
process.stdin.setRawMode(true);
process.stdin.on('data', (chunk) => {
  if (chunk[0] === 4) {
    process.exit(0);
  }
  for (const byte of chunk) {
    mcu.uart[0].feedByte(byte);
  }
});

mcu.PC = 0x10000000;
mcu.execute();
