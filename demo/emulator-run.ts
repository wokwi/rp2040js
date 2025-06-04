import * as fs from "fs";
import minimist from "minimist";
import packageJson from "../package.json" with { type: "json" };
import { GDBTCPServer } from "../src/gdb/gdb-tcp-server.js";
import { RP2040 } from "../src/index.js";
import { Simulator } from "../src/simulator.js";
import { bootromB1 } from "./bootrom.js";
import { loadHex } from "./intelhex.js";
import { loadUF2 } from "./load-flash.js";

const HELP_MESSAGE = `
${packageJson.description}

Flags:
  --image <IMAGE>: The compiled image to load and run in the emulator (.uf2, .hex). If no arguement is provided, look for a file called 'hello_uart.hex' in the current directory.
  --help: Print this help message.
  --version: Print the current rp2040js version.
`;

function loadImage(imageName = "hello_uart.hex", mcu: RP2040) {
  const extension = imageName.split(".").pop();

  if (extension === "hex") {
    // Create an array with the compiled code of blink
    // Execute the instructions from this array, one by one.
    const hex = fs.readFileSync(imageName, "utf-8");
    console.log(`Loading hex image ${imageName}`);
    loadHex(hex, mcu.flash, 0x10000000);
  } else if (extension === "uf2") {
    console.log(`Loading uf2 image ${imageName}`);
    loadUF2(imageName, mcu);
  } else {
    console.log(`Unsupported file type: ${extension}`);
    process.exit(1);
  }
}

const args = minimist(process.argv.slice(2), {
  string: [
    "image", // An image to load, hex and UF2 are supported
  ],
  boolean: [
    "help",
    "version",
  ],
});

if (args.help) {
  console.log(HELP_MESSAGE);
  process.exit(0);
}

if (args.version) {
  console.log(`rp2040js version: ${packageJson.version}`);
  process.exit(0);
}

const simulator = new Simulator();
const mcu = simulator.rp2040;
mcu.loadBootrom(bootromB1);

try {
  loadImage(args.image, mcu);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);

  console.log(`Failed to load image file: "${message}"`);
  console.log(HELP_MESSAGE);
  process.exit(1);
}

const gdbServer = new GDBTCPServer(simulator, 3333);
console.log(`RP2040 GDB Server ready! Listening on port ${gdbServer.port}`);

mcu.uart[0].onByte = (value) => {
  process.stdout.write(new Uint8Array([value]));
};

simulator.rp2040.core.PC = 0x10000000;
simulator.execute();
