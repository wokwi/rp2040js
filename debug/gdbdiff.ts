/**
 * gdbdiff - helps spotting bugs in instruction implementation.
 *
 * gdbdiff runs the same piece of code in silicone and in the emulator, instruction-by-instruction.
 * It looks for differences in register values after executing each instruction.
 *
 * Copyright (C) 2021, Uri Shaked.
 **/

import { GDBClient, dumpUint32, registerNames } from '../src/utils/gdbclient';

function printComparedRegisters(
  registers: Uint32Array,
  emulator: Uint32Array,
  silicone: Uint32Array
) {
  for (let i = 0; i < registerNames.length; i++) {
    let modified = '';
    if (emulator[i] !== silicone[i]) {
      modified = '*';
    }
    console.log(
      registerNames[i],
      modified,
      '\t\t0x' +
        dumpUint32(registers[i]) +
        '\t0x' +
        dumpUint32(emulator[i]) +
        '\t0x' +
        dumpUint32(silicone[i])
    );
    if (registerNames[i] === 'xPSR' && modified === '*') {
      console.log(
        'Flags\t\t',
        printFlags(registers[i]),
        '\t',
        printFlags(emulator[i]),
        '\t',
        printFlags(silicone[i])
      );
    }
  }
}

function printFlags(xpsr: number) {
  let negative = xpsr & 0x80000000 ? 'N' : '-';
  let zero = xpsr & 0x40000000 ? 'Z' : '-';
  let carry = xpsr & 0x20000000 ? 'C' : '-';
  let overflow = xpsr & 0x10000000 ? 'O' : '-';
  return `[${negative}${zero}${carry}${overflow}]`;
}

function compareRegisters(emulator: Uint32Array, silicone: Uint32Array) {
  let result = true;
  for (let i = 0; i < emulator.length; i++) {
    if (emulator[i] !== silicone[i]) {
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
  let counter = 1;
  for (counter = 1; ; counter++) {
    const regSet1 = await client1.readRegisters();
    const regSet2 = await client2.readRegisters();

    if (!compareRegisters(regSet1, regSet2)) {
      console.log('\nMismatch after ', counter, ' compared instructions');
      console.log('\nRegister\tStartValue\tEmulator\tSilicone');
      printComparedRegisters(lastRegSet1, regSet1, regSet2);
      process.exit(1);
    }
    lastRegSet1 = regSet1;
    await client1.singleStep();
    await client2.singleStep();
    if (counter % 500 === 0) {
      console.log(`Successfully compared ${counter} instructions`);
    }
  }
}

main().catch(console.error);
