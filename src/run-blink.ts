import * as fs from 'fs';
import { RAM_START_ADDRESS, RP2040 } from './rp2040';
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

// To start right after boot_stage2:
// mcu.PC = 0x10000100;

mcu.PC = 0x10000370;
for (let i = 0; i < 50; i++) {
  console.log(mcu.PC.toString(16));
  mcu.executeInstruction();
  // uncomment for debugging:
  // console.log(mcu.PC.toString(16), mcu.registers[2].toString(16));
}
