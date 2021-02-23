import * as fs from 'fs';
import { RP2040 } from './rp2040';
import { RPUART } from './uart';

// Create an array with the compiled code of blink
// Execute the instructions from this array, one by one.
const hex = fs.readFileSync('src/hello_uart.hex', 'utf-8');
const mcu = new RP2040(hex);

const uart = new RPUART(mcu);
uart.onByte = (value) => {
  console.log('UART sent: ', String.fromCharCode(value));
};

// To start from boot_stage2:
// load 256 bytes from flash to the end of SRAM
// mcu.LR = 0;
// const BOOT2_SIZE = 256;
// mcu.sram.set(mcu.flash.slice(0, BOOT2_SIZE), mcu.sram.length - BOOT2_SIZE);
// mcu.PC = RAM_START_ADDRESS + mcu.sram.length - BOOT2_SIZE;

mcu.PC = 0x10000000;
for (let i = 0; i < 10000; i++) {
  if (mcu.PC >= 0x10000100) {
    console.log('PC:', mcu.PC.toString(16));
  }
  mcu.executeInstruction();
}
