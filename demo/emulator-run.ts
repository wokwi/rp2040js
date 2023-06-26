import * as fs from 'fs';
import { RP2040 } from '../src';
import { bootromB1 } from './bootrom';
import { loadHex } from './intelhex';
import { GDBTCPServer } from '../src/gdb/gdb-tcp-server';

// Create an array with the compiled code of blink
// Execute the instructions from this array, one by one.
const hex = fs.readFileSync('hello_uart.hex', 'utf-8');
const mcu = new RP2040();
mcu.loadBootrom(bootromB1);
loadHex(hex, mcu.flash, 0x10000000);

const gdbServer = new GDBTCPServer(mcu, 3333);
console.log(`RP2040 GDB Server ready! Listening on port ${gdbServer.port}`);

mcu.uart[0].on('byteSent', (value) => {
  process.stdout.write(new Uint8Array([value]));
});

mcu.core.PC = 0x10000000;
mcu.execute();
