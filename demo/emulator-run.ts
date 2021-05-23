import * as fs from 'fs';
import { RP2040 } from '../src';
import { bootromB1 } from './bootrom';
import { loadHex } from './intelhex';
import { GDBTCPServer } from '../src';

// Create an array with the compiled code of blink
// Execute the instructions from this array, one by one.
const hex = fs.readFileSync(
  '/home/turro/dev/arduino/raspberrypipico/blink2/blink2/Build/blink2.ino.hex',
  'utf-8'
);
const mcu = new RP2040();

//bootromhex taken from pico by gdb running "dump ihex memory bootrom.hex 0x0 0x3fff"
if (fs.existsSync('demo/bootrom.hex')) {
  const bootromhex = fs.readFileSync('demo/bootrom.hex', 'utf-8');
  let localbootrom = new ArrayBuffer(0x4000);
  let localbootromview8 = new Uint8Array(localbootrom);
  let localbootromview32 = new Uint32Array(localbootrom);
  loadHex(bootromhex, localbootromview8, 0x00000000);
  mcu.loadBootrom(localbootromview32);
} else {
  //load the compiled bootrom
  mcu.loadBootrom(bootromB1);
}

loadHex(hex, mcu.flash, 0x10000000);

const gdbServer = new GDBTCPServer(mcu, 3334);
console.log(`RP2040 GDB Server ready! Listening on port ${gdbServer.port}`);

mcu.uart[0].onByte = (value) => {
  console.log('UART sent: ', String.fromCharCode(value));
};

mcu.PC = 0x10000000;
mcu.execute();
