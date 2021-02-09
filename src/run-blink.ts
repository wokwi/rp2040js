import * as fs from 'fs';
import { RP2040 } from './rp2040';

// Create an array with the compiled code of blink
// Execute the instructions from this array, one by one.
const hex = fs.readFileSync('src/hello_uart.hex', 'utf-8');
const mcu = new RP2040(hex);

const UART0_BASE = 0x40034000;
const UARTDR = 0x0;
const UARTFR = 0x18;

mcu.writeHooks.set(UART0_BASE + UARTDR, (address, value) => {
  console.log('UART sent: ', String.fromCharCode(value & 0xff));
});
mcu.readHooks.set(UART0_BASE + UARTFR, () => 0);

mcu.PC = 0x370;
for (let i = 0; i < 280; i++) {
  mcu.executeInstruction();
  // uncomment for debugging:
  // console.log(mcu.PC.toString(16), mcu.registers[2].toString(16));
}
