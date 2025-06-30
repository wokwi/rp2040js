import fs from 'fs';
import sade from 'sade';
import packageJson from '../package.json';
import { ConsoleLogger, LogLevel } from '../src/utils/logging.js';
import { GPIOPinState, Simulator } from '../src/index.js';
import { bootromB1 } from '../demo/bootrom.js';
import { loadMicropythonFlashImage, loadUF2 } from '../demo/load-flash.js';

type CliOpts = {
  _: string[];
};

function runTest(opts: CliOpts) {
  const simulator = new Simulator();
  const mcu = simulator.rp2040;
  mcu.loadBootrom(bootromB1);
  mcu.logger = new ConsoleLogger(LogLevel.Error);

  const imageName = 'micropython.uf2';
  console.log(`Loading uf2 image ${imageName}`);
  loadUF2(imageName, mcu);

  const littlefs = 'littlefs-spi.img';

  if (fs.existsSync(littlefs)) {
    console.log(`Loading littlefs image ${littlefs}`);
    loadMicropythonFlashImage(littlefs, mcu);
  }

  let spiBuf = '';
  mcu.gpio[5].addListener((state: GPIOPinState, oldState: GPIOPinState) => {
    if (!spiBuf) return;
    if (state !== GPIOPinState.High || oldState !== GPIOPinState.Low) return;

    if (spiBuf !== opts._?.shift()) {
      console.log('SPI TEST FAILED.');
      process.exit(1);
    } else {
      console.log('SPI MESSAGE RECEIVED.');
      spiBuf = '';
    }

    if (opts._.length === 0) {
      console.log('SPI TEST PASSED.');
      process.exit(0);
    }
  });

  const transmitAlarm = mcu.clock.createAlarm(() => {
    mcu.spi[0].completeTransmit(0);
  });

  mcu.spi[0].onTransmit = (char) => {
    spiBuf += String.fromCharCode(char);
    transmitAlarm.schedule(2000); // 2us per byte, so 4 MHz SPI
  };

  mcu.core.PC = 0x10000000;
  simulator.execute();
}

sade('test', true)
  .version(packageJson.version)
  .describe(packageJson.description)
  .example('test "hello world" "h" "0123456789abcdef0123456789abcdef0123456789abcdef"')
  .action(runTest)
  .parse(process.argv);
