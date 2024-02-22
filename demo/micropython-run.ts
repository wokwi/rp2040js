import fs from 'fs';
import minimist from 'minimist';
import { GDBTCPServer } from '../src/gdb/gdb-tcp-server.js';
import { Simulator } from '../src/simulator.js';
import { USBCDC } from '../src/usb/cdc.js';
import { ConsoleLogger, LogLevel } from '../src/utils/logging.js';
import { bootromB1 } from './bootrom.js';
import { loadCircuitpythonFlashImage, loadMicropythonFlashImage, loadUF2 } from './load-flash.js';

const args = minimist(process.argv.slice(2), {
  string: [
    'image', // UF2 image to load; defaults to "RPI_PICO-20230426-v1.20.0.uf2"
    'expect-text', // Text to expect on the serial console, process will exit with code 0 if found
  ],
  boolean: [
    'gdb', // start GDB server on 3333
    'circuitpython', // use CircuitPython instead of MicroPython
  ],
});
const expectText = args['expect-text'];

const simulator = new Simulator();
const mcu = simulator.rp2040;
mcu.loadBootrom(bootromB1);
mcu.logger = new ConsoleLogger(LogLevel.Error);

let imageName: string;
if (!args.circuitpython) {
  imageName = args.image ?? 'RPI_PICO-20230426-v1.20.0.uf2';
} else {
  imageName = args.image ?? 'adafruit-circuitpython-raspberry_pi_pico-en_US-8.0.2.uf2';
}
console.log(`Loading uf2 image ${imageName}`);
loadUF2(imageName, mcu);

if (fs.existsSync('littlefs.img') && !args.circuitpython) {
  console.log(`Loading uf2 image littlefs.img`);
  loadMicropythonFlashImage('littlefs.img', mcu);
} else if (fs.existsSync('fat12.img') && args.circuitpython) {
  loadCircuitpythonFlashImage('fat12.img', mcu);
  // Instead of reading from file, it would also be possible to generate the LittleFS image on-the-fly here, e.g. using
  // https://github.com/wokwi/littlefs-wasm or https://github.com/littlefs-project/littlefs-js
}

if (args.gdb) {
  const gdbServer = new GDBTCPServer(simulator, 3333);
  console.log(`RP2040 GDB Server ready! Listening on port ${gdbServer.port}`);
}

const cdc = new USBCDC(mcu.usbCtrl);
cdc.onDeviceConnected = () => {
  if (!args.circuitpython) {
    // We send a newline so the user sees the MicroPython prompt
    cdc.sendSerialByte('\r'.charCodeAt(0));
    cdc.sendSerialByte('\n'.charCodeAt(0));
  } else {
    cdc.sendSerialByte(3);
  }
};

let currentLine = '';
cdc.onSerialData = (value) => {
  process.stdout.write(value);

  for (const byte of value) {
    const char = String.fromCharCode(byte);
    if (char === '\n') {
      if (expectText && currentLine.includes(expectText)) {
        console.log(`Expected text found: "${expectText}"`);
        console.log('TEST PASSED.');
        process.exit(0);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
};

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}
process.stdin.on('data', (chunk) => {
  // 24 is Ctrl+X
  if (chunk[0] === 24) {
    process.exit(0);
  }
  for (const byte of chunk) {
    cdc.sendSerialByte(byte);
  }
});

simulator.rp2040.core.PC = 0x10000000;
simulator.execute();
