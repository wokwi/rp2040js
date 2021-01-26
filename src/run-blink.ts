import * as fs from 'fs';
import { RP2040 } from './rp2040';

// Create an array with the compiled code of blink
// Execute the instructions from this array, one by one.
const hex = fs.readFileSync('src/blink.hex', 'utf-8');
const mcu = new RP2040(hex);
mcu.PC = 0x370;
for (let i = 0; i < 60; i++) {
  mcu.executeInstruction();
}
