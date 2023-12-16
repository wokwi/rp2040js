import * as fs from 'fs';
import { GDBTCPServer } from '../src/gdb/gdb-tcp-server.js';
import { Simulator } from '../src/simulator.js';
import { bootromB1 } from './bootrom.js';
import { loadHex } from './intelhex.js';

// Create an array with the compiled code of blink
// Execute the instructions from this array, one by one.
const hex = fs.readFileSync('hello_uart.hex', 'utf-8');
const simulator = new Simulator();
const mcu = simulator.rp2040;
mcu.loadBootrom(bootromB1);
loadHex(hex, mcu.flash, 0x10000000);

const gdbServer = new GDBTCPServer(simulator, 3333);
console.log(`RP2040 GDB Server ready! Listening on port ${gdbServer.port}`);

mcu.uart[0].onByte = (value) => {
  process.stdout.write(new Uint8Array([value]));
};

simulator.rp2040.core.PC = 0x10000000;
simulator.execute();
