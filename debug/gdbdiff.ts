/**
 * gdbdiff - helps spotting bugs in instruction implementation.
 *
 * gdbdiff runs the same piece of code in silicone and in the emulator, instruction-by-instruction.
 * It looks for differences in register values after executing each instruction.
 *
 * Copyright (C) 2021, Uri Shaked.
 **/

import { GDBClient } from '../src/utils/gdbclient';

function compareRegisters(emulator: Uint32Array, silicone: Uint32Array) {
  let result = true;
  for (let i = 0; i < emulator.length; i++) {
    if (emulator[i] !== silicone[i]) {
      console.log(`Mismatch register ${i}: emulator ${emulator[i]} != silicone ${silicone[i]}`);
      result = false;
    }
  }
  return result;
}

async function main() {
  const client1 = new GDBClient();
  const client2 = new GDBClient();
  await client1.connect('localhost');
  await client2.connect('raspberrypi');
  // Disable interrupts
  await client1.writeRegister(19, 1, 8);
  await client2.writeRegister(19, 1, 8);
  // Start diffing
  for (let counter = 0; ; counter++) {
    const regSet1 = await client1.readRegisters();
    const regSet2 = await client2.readRegisters();
    console.log(`Instruction ${counter}`);
    await client1.dumpRegisters();
    if (!compareRegisters(regSet1, regSet2)) {
      console.log('PC (emulator): ', regSet1[15].toString(16));
      console.log('PC (silicone): ', regSet2[15].toString(16));
      break;
    }
    await client1.singleStep();
    await client2.singleStep();
    console.log('---');
  }
}

main().catch(console.error);
