import { RP2040 } from '../src';
import { GDBTCPServer } from '../src/gdb/gdb-tcp-server';
import { USBCDC } from '../src/usb/cdc';
import { ConsoleLogger, LogLevel } from '../src/utils/logging';
import { bootromB1 } from './bootrom';
import { loadUF2 } from './load-uf2';

const mcu = new RP2040();
mcu.loadBootrom(bootromB1);
mcu.logger = new ConsoleLogger(LogLevel.Error);
loadUF2('rp2-pico-20210902-v1.17.uf2', mcu);

const gdbServer = new GDBTCPServer(mcu, 3333);
console.log(`RP2040 GDB Server ready! Listening on port ${gdbServer.port}`);

const cdc = new USBCDC(mcu.usbCtrl);
cdc.onDeviceConnected = () => {
  // We send a newline so the user sees the MicroPython prompt
  cdc.sendSerialByte('\r'.charCodeAt(0));
  cdc.sendSerialByte('\n'.charCodeAt(0));
};
cdc.onSerialData = (value) => {
  process.stdout.write(value);
};

process.stdin.setRawMode(true);
process.stdin.on('data', (chunk) => {
  if (chunk[0] === 4) {
    process.exit(0);
  }
  for (const byte of chunk) {
    cdc.sendSerialByte(byte);
  }
});

mcu.PC = 0x10000000;
mcu.execute();
