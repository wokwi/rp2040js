import * as fs from 'fs';
import { RP2040 } from '../src';
import { GPIOPinState } from '../src/gpio-pin';
import { bootromB1 } from './bootrom';
import { loadHex } from './intelhex';

const hex1 = fs.readFileSync('demo/dual-mcu/dual-mcu-0.hex', 'utf-8');
const hex2 = fs.readFileSync('demo/dual-mcu/dual-mcu-1.hex', 'utf-8');
const mcu1 = new RP2040();
const mcu2 = new RP2040();
mcu1.loadBootrom(bootromB1);
mcu2.loadBootrom(bootromB1);
loadHex(hex1, mcu1.flash, 0x10000000);
loadHex(hex2, mcu2.flash, 0x10000000);

mcu1.uart[0].onByte = (value) => {
  process.stdout.write(new Uint8Array([value]));
};

mcu2.uart[0].onByte = (value) => {
  process.stdout.write(new Uint8Array([value]));
};

// GPIOPinState: { Low, High, Input, InputPullUp, InputPullDown }

const pin_state: number[][] = [
  [0, 0, 0, 0, 0, 0, 0], // result value
  [3, 3, 3, 3, 3, 3, 3], // input from mcu1 (pullup initially)
  [3, 3, 3, 3, 3, 3, 3], // input from mcu2 (pullup initially)
];
const pin_gpio: number[] = [2, 3, 4, 5, 6, 7, 8, 9];
const pin_label: string[] = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'];
const vcd_file = fs.createWriteStream('dual-mcu-bus-trace.vcd', {});
let last_conflict_cycle: number = -1;

// This listener connects the two MCUs and writes a VCD signal trace file.
// This code assumes pullups enabled (open collector/pullup bus).
function pinListener(mcu_id: number, pin: number) {
  return (state: GPIOPinState, oldState: GPIOPinState) => {
    pin_state[mcu_id + 1][pin] = state;
    const v: number = pin_state[0 + 1][pin] === 0 || pin_state[1 + 1][pin] === 0 ? 0 : 1;
    mcu1.gpio[pin_gpio[pin]].setInputValue(v == 1 ? true : false);
    mcu2.gpio[pin_gpio[pin]].setInputValue(v == 1 ? true : false);

    // write signal to VCD file
    const pin_vcd_id = String.fromCharCode(pin + 34);
    if (pin_state[0][pin] !== v) {
      pin_state[0][pin] = v;
      vcd_file.write(`#${mcu1.core.cycles} ${v}${pin_vcd_id}\n`);
    }

    // write conflict flag to VCD file
    const conflict: boolean =
      (pin_state[0 + 1][pin] === 0 && pin_state[1 + 1][pin] === 1) ||
      (pin_state[0 + 1][pin] === 1 && pin_state[1 + 1][pin] === 0);
    if (conflict)
      console.log(
        `Conflict on pin ${pin_label[pin]} at cycle ${mcu1.core.cycles} (${pin_state[0 + 1][pin]}/${
          pin_state[1 + 1][pin]
        })`
      );
    const have_new_conflict = conflict && last_conflict_cycle === -1;
    const conflict_recently_resolved = !conflict && last_conflict_cycle !== -1;
    if (conflict_recently_resolved && mcu1.core.cycles === last_conflict_cycle) {
      // one mcu set conflict and other resolved in same cycle:
      // delay until next signal change so that the conflict signal is visible in VCD
      return;
    }
    const write_conflict_flag: boolean = have_new_conflict || conflict_recently_resolved;
    if (write_conflict_flag) {
      vcd_file.write(`#${mcu1.core.cycles} ${conflict ? 1 : 0}!\n`);
    }
    last_conflict_cycle = conflict ? mcu1.core.cycles : -1;
  };
}

for (let i = 0; i < pin_label.length; i++) {
  mcu1.gpio[pin_gpio[i]].addListener(pinListener(0, i));
  mcu2.gpio[pin_gpio[i]].addListener(pinListener(1, i));
}

mcu1.core.PC = 0x10000000;
mcu2.core.PC = 0x10000000;

// write VCD file header
vcd_file.write('$timescale 1ns $end\n');
vcd_file.write('$scope module logic $end\n');
vcd_file.write(`$var wire 1 ! bus_conflict $end\n`);
for (let pin = 0; pin < pin_label.length; pin++) {
  const pin_vcd_id = String.fromCharCode(pin + 34);
  vcd_file.write(`$var wire 1 ${pin_vcd_id} ${pin_label[pin]} $end\n`);
}
vcd_file.write('$upscope $end\n');
vcd_file.write('$enddefinitions $end\n');

function run_mcus() {
  let cycles_mcu2_behind = 0;
  for (let i = 0; i < 100000; i++) {
    if (mcu1.core.cycles % (1 << 25) === 0)
      console.log(`clock: ${mcu1.core.cycles / 125000000} secs`);
    // run mcu1 for one step, take note of how many cycles that took,
    // then step mcu2 until it caught up.
    let cycles = mcu1.core.cycles;
    mcu1.step();
    cycles_mcu2_behind += mcu1.core.cycles - cycles;
    while (cycles_mcu2_behind > 0) {
      cycles = mcu2.core.cycles;
      mcu2.step();
      cycles_mcu2_behind -= mcu2.core.cycles - cycles;
    }
  }
  setTimeout(() => run_mcus(), 0);
}

run_mcus();
