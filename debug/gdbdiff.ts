/**
 * gdbdiff - helps spotting bugs in instruction implementation.
 *
 * gdbdiff runs the same piece of code in silicone and in the emulator, instruction-by-instruction.
 * It looks for differences in register values after executing each instruction.
 *
 * Copyright (C) 2021, Uri Shaked.
 **/

import { GDBClient, dumpUint32, registerNames } from '../test-utils/gdbclient';

function printComparedRegisters(
  registers: Uint32Array,
  emulator: Uint32Array,
  silicone: Uint32Array
) {
  for (let i = 0; i < registerNames.length; i++) {
    let modified = ' ';
    if (emulator[i] !== silicone[i]) {
      modified = '*';
    }
    console.log(
      registerNames[i] + modified,
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
  const negative = xpsr & 0x80000000 ? 'N' : '-';
  const zero = xpsr & 0x40000000 ? 'Z' : '-';
  const carry = xpsr & 0x20000000 ? 'C' : '-';
  const overflow = xpsr & 0x10000000 ? 'O' : '-';
  return `[${negative}${zero}${carry}${overflow}]`;
}

async function compareFixRegisters(
  emulator: Uint32Array,
  silicone: Uint32Array,
  toFixClient: GDBClient
) {
  let result = true;
  for (let i = 0; i < emulator.length; i++) {
    if (emulator[i] !== silicone[i]) {
      await toFixClient.writeRegister(i, silicone[i]);
      result = false;
    }
  }
  return result;
}

async function main() {
  const emulatorClient = new GDBClient();
  const siliconeClient = new GDBClient();
  await emulatorClient.connect('localhost', 3334);
  await siliconeClient.connect('localhost', 3333);
  // Disable interrupts
  await emulatorClient.writeRegister(19, 1, 8);
  await siliconeClient.writeRegister(19, 1, 8);
  // Start diffing
  let prevRegSet = await siliconeClient.readRegisters();
  for (let counter = 1; ; counter++) {
    const emulatorRegSet = await emulatorClient.readRegisters();
    const siliconeRegSet = await siliconeClient.readRegisters();

    if (!(await compareFixRegisters(emulatorRegSet, siliconeRegSet, emulatorClient))) {
      console.log('\n\nMismatch after ', counter, ' compared instructions');
      console.log('\nRegister\tStartValue\tEmulator\tSilicone');
      printComparedRegisters(prevRegSet, emulatorRegSet, siliconeRegSet);
    }
    prevRegSet = emulatorRegSet;
    await emulatorClient.singleStep();
    await siliconeClient.singleStep();
    if (counter % 200 === 0) {
      console.log(`Successfully compared ${counter} instructions`);
    }
  }
}

main().catch(console.error);
