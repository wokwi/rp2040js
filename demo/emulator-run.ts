import * as fs from 'fs';
import { GDBTCPServer } from '../src/gdb/gdb-tcp-server.js';
import { Simulator } from '../src/simulator.js';
import { bootromB1 } from './bootrom.js';
import { loadHex } from './intelhex.js';
import { loadUF2 } from './load-flash.js';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2), {
  string: [
    'image', // An image to load, hex and UF2 are supported
  ],
});

const simulator = new Simulator();
const mcu = simulator.rp2040;
mcu.loadBootrom(bootromB1);

const imageName = args.image ?? 'hello_uart.hex'

// Check the extension of the file
const extension = imageName.split('.').pop();
if (extension === 'hex') {
  // Create an array with the compiled code of blink
  // Execute the instructions from this array, one by one.
  const hex = fs.readFileSync(imageName, 'utf-8');

  console.log(`Loading hex image ${imageName}`);
  loadHex(hex, mcu.flash, 0x10000000);
} else if (extension === 'uf2') {
  console.log(`Loading uf2 image ${imageName}`);
  loadUF2(imageName, mcu);
} else {
  console.log(`Unsupported file type: ${extension}`);
  process.exit(1);
}

const gdbServer = new GDBTCPServer(simulator, 3333);
console.log(`RP2040 GDB Server ready! Listening on port ${gdbServer.port}`);

mcu.uart[0].onByte = (value) => {
  process.stdout.write(new Uint8Array([value]));
};

simulator.rp2040.core.PC = 0x10000000;
simulator.execute();
