import fs from 'fs';
import packageJson from '../package.json';
import sade from 'sade';
import { GDBTCPServer } from '../src/gdb/gdb-tcp-server.js';
import { RP2040 } from '../src/index.js';
import { Simulator } from '../src/simulator.js';
import { USBCDC } from '../src/usb/cdc.js';
import { ConsoleLogger, LogLevel } from '../src/utils/logging.js';
import { bootromB1 } from './bootrom.js';
import { loadCircuitpythonFlashImage, loadMicropythonFlashImage, loadUF2 } from './load-flash.js';

type CliOptions = {
  image: string | null;
  'expect-text': string | null;
  gdb: boolean;
  'gdb-port': number;
  'circuit-python': boolean;
};

function loadImage(mcu: RP2040, image: string | null, useCircuitPython: boolean) {
  let selectedImage: string;
  if (image) selectedImage = image;
  else if (useCircuitPython)
    selectedImage = 'adafruit-circuitpython-raspberry_pi_pico-en_US-8.0.2.uf2';
  else selectedImage = 'RPI_PICO-20230426-v1.20.0.uf2';

  console.log(`Loading uf2 image ${selectedImage}`);

  try {
    loadUF2(selectedImage, mcu);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    console.log(`Error: Failed to load image file: "${message}"`);
    process.exit(1);
  }

  if (fs.existsSync('littlefs.img') && !useCircuitPython) {
    console.log(`Loading uf2 image littlefs.img`);
    loadMicropythonFlashImage('littlefs.img', mcu);
  } else if (fs.existsSync('fat12.img') && useCircuitPython) {
    loadCircuitpythonFlashImage('fat12.img', mcu);
    // Instead of reading from file, it would also be possible to generate the LittleFS image on-the-fly here, e.g. using
    // https://github.com/wokwi/littlefs-wasm or https://github.com/littlefs-project/littlefs-js
  }
}

function handleDeviceConnected(cdc: USBCDC, useCircuitPython: boolean) {
  if (useCircuitPython) {
    cdc.sendSerialByte(3);
    return;
  }

  // We send a newline so the user sees the MicroPython prompt
  cdc.sendSerialByte('\r'.charCodeAt(0));
  cdc.sendSerialByte('\n'.charCodeAt(0));
}

function testWriteSerialData(value: Uint8Array, expectText: string, decoder: TextDecoder) {
  process.stdout.write(value);

  const current = decoder.decode(value);

  if (current.includes(expectText)) {
    console.log(`\nExpected text found: "${expectText}"`);
    console.log('TEST PASSED.');
    process.exit(0);
  }
}

function installSerialDataWriter(cdc: USBCDC, expectText: string | null) {
  if (expectText) {
    const decoder = new TextDecoder();
    cdc.onSerialData = (value) => testWriteSerialData(value, expectText, decoder);
  } else {
    cdc.onSerialData = (value) => process.stdout.write(value);
  }
}

function simulateMicropythonImage(opts: CliOptions) {
  const simulator = new Simulator();
  const mcu = simulator.rp2040;
  mcu.loadBootrom(bootromB1);
  mcu.logger = new ConsoleLogger(LogLevel.Error);

  loadImage(mcu, opts.image, opts['circuit-python']);

  if (opts.gdb) {
    const gdbServer = new GDBTCPServer(simulator, opts['gdb-port']);
    console.log(`RP2040 GDB Server ready! Listening on port ${gdbServer.port}`);
  }

  const cdc = new USBCDC(mcu.usbCtrl);
  cdc.onDeviceConnected = () => handleDeviceConnected(cdc, opts['circuit-python']);
  installSerialDataWriter(cdc, opts['expect-text']);

  if (process.stdin.isTTY) process.stdin.setRawMode(true);

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
}

sade('rp2040js-micropython', true)
  .version(packageJson.version)
  .describe(packageJson.description)
  .option('-i, --image', 'UF2 image to load')
  .option(
    '-e, --expect-text',
    'Text to expect on the serial console, process will exit with code 0 if found',
  )
  .option('-g, --gdb', 'If a GDB server should be started on 3333 or not', false)
  .option('-p, --gdb-port', 'The port to start the gdb server on', 3333)
  .option('-c, --circuit-python', 'If CircuitPython should be used instead of MicroPython', false)
  .example('--image ./my-image.uf2')
  .action(simulateMicropythonImage)
  .parse(process.argv);
