import * as fs from 'fs';
import packageJson from '../package.json';
import sade from 'sade';
import { GDBTCPServer } from '../src/gdb/gdb-tcp-server.js';
import { RP2040 } from '../src/index.js';
import { Simulator } from '../src/simulator.js';
import { bootromB1 } from './bootrom.js';
import { loadHex } from './intelhex.js';
import { loadUF2 } from './load-flash.js';

type CliOptions = {
  image: string;
  gdb: boolean;
  'gdb-port': number;
};

function loadImage(imageName: string, mcu: RP2040) {
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
}

function simulateImage(opts: CliOptions) {
  const simulator = new Simulator();
  const mcu = simulator.rp2040;
  mcu.loadBootrom(bootromB1);

  try {
    loadImage(opts.image, mcu);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    console.log(`Error: Failed to load image file: "${message}"`);
    process.exit(1);
  }

  if (opts.gdb) {
    const gdbServer = new GDBTCPServer(simulator, opts['gdb-port']);
    console.log(`RP2040 GDB Server ready! Listening on port ${gdbServer.port}`);
  }

  mcu.uart[0].onByte = (value) => {
    process.stdout.write(new Uint8Array([value]));
  };

  simulator.rp2040.core.PC = 0x10000000;
  simulator.execute();
}

sade('rp2040js', true)
  .version(packageJson.version)
  .describe(packageJson.description)
  .option('-i, --image', 'Provide an image to run (.uf2, .hex)', 'hello_uart.hex')
  .option('-g, --gdb', 'If a GDB server should be started or not', true)
  .option('-p, --gdb-port', 'The port to start the gdb server on', 3333)
  .example('--image ./hello_world.uf2')
  .action(simulateImage)
  .parse(process.argv);
