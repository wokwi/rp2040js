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

mcu.PC = 0x370;
for (let i = 0; i < 280; i++) {
  mcu.executeInstruction();
  // uncomment for debugging:
  // console.log(mcu.PC.toString(16), mcu.registers[2].toString(16));
}
