/**
 * gdbdiff - helps spotting bugs in instruction implementation.
 *
 * gdbdiff runs the same piece of code in silicone and in the emulator, instruction-by-instruction.
 * It looks for differences in register values after executing each instruction.
 *
 * Copyright (C) 2021, Uri Shaked.
 **/

import { GDBClient, dumpUint32, registerNames } from '../src/utils/gdbclient';

function printComparedRegisters(emulator: Uint32Array, silicone: Uint32Array) {
  console.log('Registers \t Emulator \t     Silicone');
  for (let i = 0; i < registerNames.length; i++) {
    console.log(
      registerNames[i],
      '    \t\t0x' + dumpUint32(emulator[i]) + '\t\t 0x' + dumpUint32(silicone[i])
    );
  }
}

function compareRegisters(emulator: Uint32Array, silicone: Uint32Array) {
  let result = true;
  for (let i = 0; i < emulator.length; i++) {
    if (emulator[i] !== silicone[i]) {
      console.log(
        `Mismatch register ${i}: emulator 0x${emulator[i].toString(16)} != silicone 0x${silicone[
          i
        ].toString(16)}`
      );
      result = false;
    }
  }
  return result;
}

async function main() {
  const client1 = new GDBClient();
  const client2 = new GDBClient();
  await client1.connect('localhost', 3334);
  await client2.connect('localhost', 3333);
  // Disable interrupts
  await client1.writeRegister(19, 1, 8);
  await client2.writeRegister(19, 1, 8);
  // Start diffing
  let lastRegSet1 = await client1.readRegisters();
  let lastRegSet2 = await client2.readRegisters();
  let counter = 0;
  for (counter = 0; ; counter++) {
    const regSet1 = await client1.readRegisters();
    const regSet2 = await client2.readRegisters();
    //await client1.dumpRegisters();
    if (!compareRegisters(regSet1, regSet2)) {
      console.log('status register at failed instruction:');
      printComparedRegisters(lastRegSet1, lastRegSet2);
      console.log('Status register at current instruction:');
      printComparedRegisters(regSet1, regSet2);
      break;
    }
    lastRegSet1 = regSet1;
    lastRegSet2 = regSet2;
    await client1.singleStep();
    await client2.singleStep();
    if (counter % 500 === 0) {
      console.log('Successfully compared ' + counter + ' instructions');
    }
    //console.log('---');
  }
}

main().catch(console.error);
