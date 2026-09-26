/**
 * Unit tests for RPSSI's software-driven SPI NOR flash command emulation (write support - the
 * SSI peripheral used to be a register-only stub with no real flash-write path).
 *
 * These drive the peripheral's registers directly (SSIENR/DR0) plus the QSPI_SS pin (see ssi.ts's
 * onCSPinChanged comment for why chip-select is that pin, not SSIENR/SER, on RP2040) - exactly
 * matching what real flash driver code does at the bus level, rather than booting a full firmware
 * image. The real bootrom's exact command sequence is a different concern from whether this
 * peripheral correctly implements the JEDEC command set once framed correctly.
 */
import { describe, expect, it } from 'vitest';
import { GPIOPinState } from '../gpio-pin.js';
import { RP2040 } from '../rp2040.js';
import { RPSSI } from './ssi.js';

const SSI_SSIENR = 0x00000008;
const SSI_RXFLR = 0x00000024;
const SSI_DR0 = 0x00000060;

const CMD_WRITE_ENABLE = 0x06;
const CMD_WRITE_DISABLE = 0x04;
const CMD_READ_STATUS_1 = 0x05;
const CMD_READ_STATUS_2 = 0x35;
const CMD_WRITE_STATUS = 0x01;
const CMD_PAGE_PROGRAM = 0x02;
const CMD_SECTOR_ERASE = 0x20;
const CMD_BLOCK_ERASE = 0xd8;
const CMD_READ_DATA = 0x03;
const CMD_READ_JEDEC_ID = 0x9f;

const STATUS_WEL_BIT = 0x02;
const STATUS2_QE_BIT = 0x02;
const JEDEC_ID = [0xef, 0x40, 0x15];

// GPIOPin.ctrl's output-override field (bits 9:8): 2 = force low, 3 = force high - matching
// pico-sdk's flash_cs_force()/IO_QSPI_GPIO_QSPI_SS_CTRL_OUTOVER_VALUE_LOW/HIGH exactly. Real
// flash_cs_force() only masks in the OUTOVER bits, relying on output-enable-override (bits 13:12)
// already being forced on from earlier bootrom setup (connect_internal_flash()) - forced here
// too, since these tests drive SSI directly without replicating that earlier real-bootrom setup.
const OE_FORCE_ENABLED = 3 << 12;
const CS_FORCE_LOW = OE_FORCE_ENABLED | (2 << 8);
const CS_FORCE_HIGH = OE_FORCE_ENABLED | (3 << 8);

function setup() {
  const rp2040 = new RP2040();
  const ssi = rp2040.peripherals[0x18000] as RPSSI;
  return { rp2040, ssi };
}

/**
 * Drives one full SPI transaction: chip-select assert (QSPI_SS forced low), each byte written to
 * DR0 and immediately read back (matching real full-duplex shift-register semantics), then
 * chip-select deassert (QSPI_SS forced high, which is when erase/program actually apply).
 */
function send(rp2040: RP2040, ssi: RPSSI, ...commandBytes: number[]): number[] {
  ssi.writeUint32(SSI_SSIENR, 1);
  const ssPin = rp2040.qspi[1];
  ssPin.ctrl = CS_FORCE_LOW;
  ssPin.checkForUpdates();
  const received: number[] = [];
  for (const byte of commandBytes) {
    ssi.writeUint32(SSI_DR0, byte);
    received.push(ssi.readUint32(SSI_DR0));
  }
  ssPin.ctrl = CS_FORCE_HIGH;
  ssPin.checkForUpdates();
  return received;
}

function readStatus(rp2040: RP2040, ssi: RPSSI): number {
  return send(rp2040, ssi, CMD_READ_STATUS_1, 0x00)[1];
}

describe('RPSSI flash write emulation', () => {
  it.each([4096, 65536])('erase without write-enable is a no-op (size=%d)', (size) => {
    const opcode = size === 4096 ? CMD_SECTOR_ERASE : CMD_BLOCK_ERASE;
    const { rp2040, ssi } = setup();
    for (let i = 0; i < size; i++) {
      rp2040.flash[i] = i % 256;
    }
    const before = rp2040.flash.slice(0, size);

    send(rp2040, ssi, opcode, 0x00, 0x00, 0x00);

    expect(rp2040.flash.slice(0, size)).toEqual(before);
  });

  it('page program without write-enable is a no-op', () => {
    const { rp2040, ssi } = setup();
    expect(Array.from(rp2040.flash.slice(0, 4))).toEqual([0xff, 0xff, 0xff, 0xff]); // freshly reset, erased flash

    send(rp2040, ssi, CMD_PAGE_PROGRAM, 0x00, 0x00, 0x00, 0xaa, 0xbb);

    expect(Array.from(rp2040.flash.slice(0, 4))).toEqual([0xff, 0xff, 0xff, 0xff]);
  });

  it('write-enable then page program writes data', () => {
    const { rp2040, ssi } = setup();
    send(rp2040, ssi, CMD_WRITE_ENABLE);

    send(rp2040, ssi, CMD_PAGE_PROGRAM, 0x00, 0x00, 0x10, 'h'.charCodeAt(0), 'i'.charCodeAt(0));

    expect(Array.from(rp2040.flash.slice(0x10, 0x12))).toEqual([
      'h'.charCodeAt(0),
      'i'.charCodeAt(0),
    ]);
  });

  it('program can only clear bits, not set them', () => {
    // Real NOR flash physics: PROGRAM can only turn 1 bits into 0, never the reverse - only ERASE
    // resets a region back to all-1s. Programming without erasing first should AND with whatever
    // was already there, not overwrite it - the same thing well-behaved software avoids by always
    // erasing first, but the peripheral should still behave like real hardware if it doesn't.
    const { rp2040, ssi } = setup();
    rp2040.flash[0x20] = 0b11110000;
    send(rp2040, ssi, CMD_WRITE_ENABLE);

    send(rp2040, ssi, CMD_PAGE_PROGRAM, 0x00, 0x00, 0x20, 0b10101010);

    expect(rp2040.flash[0x20]).toBe(0b11110000 & 0b10101010);
  });

  it('write-enable auto-clears after program completes', () => {
    const { rp2040, ssi } = setup();
    send(rp2040, ssi, CMD_WRITE_ENABLE);
    expect(readStatus(rp2040, ssi) & STATUS_WEL_BIT).toBeTruthy();

    send(rp2040, ssi, CMD_PAGE_PROGRAM, 0x00, 0x00, 0x00, 0x01);

    expect(readStatus(rp2040, ssi) & STATUS_WEL_BIT).toBeFalsy();
  });

  it('write-disable clears the write-enable latch', () => {
    const { rp2040, ssi } = setup();
    send(rp2040, ssi, CMD_WRITE_ENABLE);
    send(rp2040, ssi, CMD_WRITE_DISABLE);

    expect(readStatus(rp2040, ssi) & STATUS_WEL_BIT).toBeFalsy();
  });

  it('sector erase resets the 4K region to 0xFF', () => {
    const { rp2040, ssi } = setup();
    rp2040.flash.fill(0x42, 0, 8192);
    send(rp2040, ssi, CMD_WRITE_ENABLE);

    send(rp2040, ssi, CMD_SECTOR_ERASE, 0x00, 0x00, 0x00);

    expect(rp2040.flash.slice(0, 4096).every((b) => b === 0xff)).toBe(true);
    expect(rp2040.flash.slice(4096, 8192).every((b) => b === 0x42)).toBe(true); // untouched, outside the erased sector
  });

  it('block erase resets the 64K region to 0xFF', () => {
    const { rp2040, ssi } = setup();
    rp2040.flash.fill(0x42, 0, 65536);
    send(rp2040, ssi, CMD_WRITE_ENABLE);

    send(rp2040, ssi, CMD_BLOCK_ERASE, 0x00, 0x00, 0x00);

    expect(rp2040.flash.slice(0, 65536).every((b) => b === 0xff)).toBe(true);
  });

  it('erase address aligns down to the sector boundary', () => {
    const { rp2040, ssi } = setup();
    rp2040.flash.fill(0x42, 0, 8192);
    send(rp2040, ssi, CMD_WRITE_ENABLE);

    // Address 0x0500 is mid-sector (sectors are 4096 = 0x1000 bytes) - real flash erases the
    // whole containing sector regardless, not just from the given address onward.
    send(rp2040, ssi, CMD_SECTOR_ERASE, 0x00, 0x05, 0x00);

    expect(rp2040.flash.slice(0, 4096).every((b) => b === 0xff)).toBe(true);
    expect(rp2040.flash.slice(4096, 8192).every((b) => b === 0x42)).toBe(true);
  });

  it('read status 1 reports the write-enable latch', () => {
    const { rp2040, ssi } = setup();
    expect(readStatus(rp2040, ssi) & STATUS_WEL_BIT).toBeFalsy();

    send(rp2040, ssi, CMD_WRITE_ENABLE);

    expect(readStatus(rp2040, ssi) & STATUS_WEL_BIT).toBeTruthy();
  });

  it('read status 2 reports quad-enable already set', () => {
    // See ssi.ts's STATUS2_QE_BIT comment: reported permanently set so flash-detection code that
    // checks-then-sets quad mode sees it's already enabled and doesn't need to issue WRSR.
    const { rp2040, ssi } = setup();
    const received = send(rp2040, ssi, CMD_READ_STATUS_2, 0x00);
    expect(received[1] & STATUS2_QE_BIT).toBeTruthy();
  });

  it('write status is accepted and clears write-enable', () => {
    const { rp2040, ssi } = setup();
    send(rp2040, ssi, CMD_WRITE_ENABLE);

    send(rp2040, ssi, CMD_WRITE_STATUS, 0x00, 0x02);

    expect(readStatus(rp2040, ssi) & STATUS_WEL_BIT).toBeFalsy();
  });

  it('read JEDEC ID returns the configured ID', () => {
    const { rp2040, ssi } = setup();
    const received = send(rp2040, ssi, CMD_READ_JEDEC_ID, 0x00, 0x00, 0x00);
    expect(received.slice(1, 4)).toEqual(JEDEC_ID);
  });

  it('read data returns actual flash contents', () => {
    const { rp2040, ssi } = setup();
    rp2040.flash[0x30] = 'b'.charCodeAt(0);
    rp2040.flash[0x31] = 'o'.charCodeAt(0);
    rp2040.flash[0x32] = 'o'.charCodeAt(0);
    rp2040.flash[0x33] = 't'.charCodeAt(0);

    const received = send(rp2040, ssi, CMD_READ_DATA, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00, 0x00);

    expect(received.slice(4, 8)).toEqual([
      'b'.charCodeAt(0),
      'o'.charCodeAt(0),
      'o'.charCodeAt(0),
      't'.charCodeAt(0),
    ]);
  });

  it('a command interrupted before chip-select deasserts never applies', () => {
    // QSPI_SS never goes back to high (deasserted) here - real hardware only actually commits an
    // erase/program once chip-select deasserts (the whole point of deferring applyCommand() to
    // that transition, see ssi.ts) - so nothing should happen yet.
    const { rp2040, ssi } = setup();
    const ssPin = rp2040.qspi[1];
    ssi.writeUint32(SSI_SSIENR, 1);
    ssPin.ctrl = CS_FORCE_LOW;
    ssPin.checkForUpdates();
    ssi.writeUint32(SSI_DR0, CMD_WRITE_ENABLE);
    ssPin.ctrl = CS_FORCE_HIGH;
    ssPin.checkForUpdates(); // complete the WREN
    ssPin.ctrl = CS_FORCE_LOW;
    ssPin.checkForUpdates(); // start PAGE_PROGRAM, but never deassert below
    for (const byte of [CMD_PAGE_PROGRAM, 0x00, 0x00, 0x00, 0xaa]) {
      ssi.writeUint32(SSI_DR0, byte);
    }

    expect(rp2040.flash[0]).toBe(0xff);
  });

  it('SSI disabled ignores DR0 writes even with chip-select asserted', () => {
    const { rp2040, ssi } = setup();
    const ssPin = rp2040.qspi[1];
    ssPin.ctrl = CS_FORCE_LOW;
    ssPin.checkForUpdates();

    ssi.writeUint32(SSI_DR0, CMD_WRITE_ENABLE); // SSIENR never set to 1

    ssPin.ctrl = CS_FORCE_HIGH;
    ssPin.checkForUpdates();
    expect(readStatus(rp2040, ssi) & STATUS_WEL_BIT).toBeFalsy();
  });

  it('chip-select already asserted at reset is not silently missed', () => {
    // QSPI_SS's own reset-state resolved `.value` is Low (asserted) - an alwaysOutputEnabled pin
    // with no function-select driving it yet resolves to Low, same as a regular disabled GPIO
    // would resolve to floating/Input if it weren't hardcoded always-driven. RPSSI's internal
    // csAsserted must start in sync with that, or the very first chip-select assertion ever
    // performed (a plain "force low" with the pin already reading low, i.e. no rising/falling
    // edge to fire onCSPinChanged) is invisible to this peripheral, and every byte of that first
    // command is silently dropped by writeUint32's csAsserted guard - this reproduces exactly the
    // hang the bootrom's flash_do_cmd_cs()-equivalent loop suffered from.
    const { rp2040, ssi } = setup();
    expect(rp2040.qspi[1].value).toBe(GPIOPinState.Low);

    const received = send(rp2040, ssi, CMD_READ_JEDEC_ID, 0x00, 0x00, 0x00);

    expect(received.slice(1, 4)).toEqual(JEDEC_ID);
  });

  it('DR0 writes while chip-select is deasserted still advance the FIFO', () => {
    // Real SSI FIFO hardware (TXFLR/RXFLR/DR0) is wired independently of the QSPI_SS GPIO pin -
    // it keeps shifting bytes regardless of chip-select state (CS is a software-only bit-banged
    // GPIO concern here, see ssi.ts's chip-select comment). Firmware relies on this: the
    // bootrom's flash_exit_xip() deliberately clocks dummy bytes through DR0 *while chip-select
    // is forced high* (pico-bootrom's program_flash_generic.c, the Micron-compatibility
    // dummy-clock sequence) - if those writes were silently dropped instead of still populating
    // the RX FIFO, firmware's TXFLR/RXFLR-driven flow-control loop spins forever waiting for
    // bytes that will never arrive. None of this should be interpreted as a real flash command,
    // though - only bytes clocked in while actually chip-selected go through shiftByte()/affect
    // flash state.
    const { rp2040, ssi } = setup();
    const ssPin = rp2040.qspi[1];
    ssi.writeUint32(SSI_SSIENR, 1);
    ssPin.ctrl = CS_FORCE_HIGH; // deasserted
    ssPin.checkForUpdates();

    ssi.writeUint32(SSI_DR0, CMD_WRITE_ENABLE);

    expect(ssi.readUint32(SSI_RXFLR)).toBe(1);
    expect(ssi.readUint32(SSI_DR0)).toBe(0xff);
    expect(readStatus(rp2040, ssi) & STATUS_WEL_BIT).toBeFalsy(); // not interpreted as a real command
  });
});
