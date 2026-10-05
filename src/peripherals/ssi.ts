import { GPIOPinState } from '../gpio-pin.js';
import { RP2040 } from '../rp2040.js';
import { BasePeripheral, Peripheral } from './peripheral.js';

/* See RP2040 datasheet sect 4.10.13 */
const SSI_CTRLR0 = 0x00000000;
const SSI_CTRLR1 = 0x00000004;
const SSI_SSIENR = 0x00000008;
const SSI_MWCR = 0x0000000c;
const SSI_SER = 0x00000010;
const SSI_BAUDR = 0x00000014;
const SSI_TXFTLR = 0x00000018;
const SSI_RXFTLR = 0x0000001c;
const SSI_TXFLR = 0x00000020;
const SSI_RXFLR = 0x00000024;
const SSI_SR = 0x00000028;
const SSI_SR_TFNF_BITS = 0x00000002;
const SSI_SR_TFE_BITS = 0x00000004;
const SSI_SR_RFNE_BITS = 0x00000008;
const SSI_IMR = 0x0000002c;
const SSI_ISR = 0x00000030;
const SSI_RISR = 0x00000034;
const SSI_TXOICR = 0x00000038;
const SSI_RXOICR = 0x0000003c;
const SSI_RXUICR = 0x00000040;
const SSI_MSTICR = 0x00000044;
const SSI_ICR = 0x00000048;
const SSI_DMACR = 0x0000004c;
const SSI_DMATDLR = 0x00000050;
const SSI_DMARDLR = 0x00000054;
/** Identification register */
const SSI_IDR = 0x00000058;
const SSI_VERSION_ID = 0x0000005c;
const SSI_DR0 = 0x00000060;
const SSI_RX_SAMPLE_DLY = 0x000000f0;
const SSI_SPI_CTRL_R0 = 0x000000f4;
const SSI_TXD_DRIVE_EDGE = 0x000000f8;

// JEDEC-standard SPI NOR flash commands - the subset the RP2040 bootrom's ROM_FUNC_FLASH_*
// helpers (called by the Pico SDK's flash_range_erase()/flash_range_program(), themselves called
// by MicroPython's rp2.Flash) actually issue over this peripheral. XIP reads never reach here -
// RP2040's flash reads are served directly from the `flash` array - so this only needs to cover
// what real flash-*writing* software drives.
const CMD_WRITE_ENABLE = 0x06;
const CMD_WRITE_DISABLE = 0x04;
const CMD_READ_STATUS_1 = 0x05;
const CMD_READ_STATUS_2 = 0x35;
const CMD_WRITE_STATUS = 0x01;
const CMD_PAGE_PROGRAM = 0x02;
const CMD_SECTOR_ERASE = 0x20; // 4 KB
const CMD_BLOCK_ERASE = 0xd8; // 64 KB
const CMD_READ_DATA = 0x03;
const CMD_READ_JEDEC_ID = 0x9f;

const FLASH_PAGE_SIZE = 256;
const FLASH_SECTOR_SIZE = 4096;
const FLASH_BLOCK_SIZE = 65536;

const STATUS_WEL_BIT = 0x02; // write-enable-latch (status register 1)
// quad-enable (status register 2) - reported permanently set: connect_internal_flash() reads
// this before deciding whether it needs to issue CMD_WRITE_STATUS to turn quad mode on -
// reporting it already enabled lets that check succeed immediately rather than retrying a WRSR
// sequence this peripheral doesn't need to act on (nothing here depends on quad vs standard SPI
// framing either way).
const STATUS2_QE_BIT = 0x02;

// Arbitrary but plausible Winbond-shaped ID (manufacturer, memory type, capacity) - nothing in
// the boot/flash path is known to hard-require a specific real chip's exact ID, just *a*
// consistent 3-byte response to CMD_READ_JEDEC_ID.
const JEDEC_ID = [0xef, 0x40, 0x15];

export class RPSSI extends BasePeripheral implements Peripheral {
  private txflr = 0;
  private baudr = 0;
  private crtlr0 = 0;
  private crtlr1 = 0;
  private ssienr = 0;
  private spictlr0 = 0;
  private rxsampldly = 0;
  private txddriveedge = 0;

  // Software-driven SPI NOR flash command state (see the module comment above): `txBuffer`
  // accumulates the bytes shifted out via DR0 since chip-select was last asserted - real flash
  // commands are framed by chip-select, not by anything visible in the byte stream itself. On
  // RP2040, chip-select is *not* SSI's own SER/SSIENR - the Pico SDK's flash_cs_force() bit-bangs
  // the QSPI_SS pin's IO_QSPI override directly instead ("in case RAM-resident IRQs are still
  // running... the bootrom does the same", per its own comment in pico-sdk's flash.c), bypassing
  // SSI's chip-select machinery entirely. So framing here keys off `rp2040.qspi[1]` (QSPI_SS,
  // active-low) actually changing value, not SSIENR. `rxQueue` holds bytes shifted *in* (the
  // flash chip's response) waiting to be read back via DR0 - necessary because a real SPI
  // transfer is full-duplex (every outgoing byte has a corresponding incoming one), and
  // multi-byte responses (JEDEC ID, read-status, page reads) need to come back in the right order
  // across several DR0 reads.
  private writeEnabled = false;
  // Synced to the pin's actual resolved value at construction time, not hardcoded false -
  // QSPI_SS's own reset state (an `alwaysOutputEnabled` pin with no function-select driving it
  // yet resolves to LOW, i.e. *asserted*) can already be "asserted" before any real edge ever
  // happens. Hardcoding false here desyncs this flag from the pin: the bootrom's first-ever
  // flash_cs_force(low) is then a no-op (LOW -> LOW, no edge fires onCSPinChanged), so
  // csAsserted would stay wrongly false forever and every byte of that first command would be
  // silently dropped by writeUint32's `ssienr && csAsserted` guard - starving the bootrom's
  // flash_do_cmd_cs() TX/RX FIFO-drain loop of the RX bytes it's waiting for and hanging it
  // forever.
  private csAsserted: boolean;
  private txBuffer: number[] = [];
  private rxQueue: number[] = [];

  constructor(rp2040: RP2040, name: string) {
    super(rp2040, name);
    this.csAsserted = rp2040.qspi[1].value === GPIOPinState.Low;
    rp2040.qspi[1].addListener(this.onCSPinChanged);
  }

  readUint32(offset: number) {
    switch (offset) {
      case SSI_TXFLR:
        return this.txflr;
      case SSI_RXFLR:
        return this.rxQueue.length;
      case SSI_CTRLR0:
        return this.crtlr0; /*  & 0x017FFFFF = b23,b25..31 reserved */
      case SSI_CTRLR1:
        return this.crtlr1;
      case SSI_SSIENR:
        return this.ssienr;
      case SSI_BAUDR:
        return this.baudr;
      case SSI_SR: {
        const rfne = this.rxQueue.length ? SSI_SR_RFNE_BITS : 0;
        return SSI_SR_TFE_BITS | SSI_SR_TFNF_BITS | rfne;
      }
      case SSI_IDR:
        return 0x51535049;
      case SSI_VERSION_ID:
        return 0x3430312a;
      case SSI_RX_SAMPLE_DLY:
        return this.rxsampldly;
      case SSI_TXD_DRIVE_EDGE:
        return this.txddriveedge;
      case SSI_SPI_CTRL_R0:
        return this.spictlr0; /* b6,7,10,19..23 reserved */
      case SSI_DR0:
        return this.rxQueue.length ? this.rxQueue.shift()! : 0;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case SSI_TXFLR:
        this.txflr = value;
        return;
      case SSI_RXFLR:
        // real hardware: read-only FIFO-level status, write is a no-op
        return;
      case SSI_CTRLR0:
        this.crtlr0 = value; /*  & 0x017FFFFF = b23,b25..31 reserved */
        return;
      case SSI_CTRLR1:
        this.crtlr1 = value;
        return;
      case SSI_SSIENR:
        this.ssienr = value;
        return;
      case SSI_BAUDR:
        this.baudr = value;
        return;
      case SSI_RX_SAMPLE_DLY:
        this.rxsampldly = value & 0xff;
        return;
      case SSI_TXD_DRIVE_EDGE:
        this.txddriveedge = value & 0xff;
        return;
      case SSI_SPI_CTRL_R0:
        this.spictlr0 = value;
        return;
      case SSI_DR0:
        if (this.ssienr) {
          if (this.csAsserted) {
            this.rxQueue.push(this.shiftByte(value & 0xff));
          } else {
            // SSI's shift register/FIFOs are wired independently of the QSPI_SS GPIO pin - real
            // hardware keeps shifting bytes through DR0 even while software has forced
            // chip-select high (e.g. flash_exit_xip()'s deliberate CS-high dummy-clock
            // compatibility sequence, pico-bootrom's program_flash_generic.c). The virtual flash
            // chip isn't "listening" in that state, so there's nothing meaningful to shift back -
            // 0xFF (idle bus), same fallback shiftByte() uses for an unrecognized opcode - but the
            // RX FIFO must still gain an entry, or firmware's TXFLR/RXFLR-driven flow-control loop
            // (bootrom's flash_put_get()) spins forever waiting for bytes that will never arrive.
            this.rxQueue.push(0xff);
          }
        }
        return;
      default:
        super.writeUint32(offset, value);
    }
  }

  private onCSPinChanged = (value: GPIOPinState) => {
    // QSPI_SS is active-low: LOW means the flash chip is selected.
    const nowAsserted = value === GPIOPinState.Low;
    if (nowAsserted && !this.csAsserted) {
      // Chip-select asserting: start a fresh command.
      this.txBuffer = [];
      this.rxQueue = [];
    } else if (this.csAsserted && !nowAsserted) {
      // Chip-select deasserting: the command (and, for PAGE_PROGRAM, however many data bytes were
      // shifted - not knowable in advance, only by where chip-select ends up deasserted) is now
      // complete - apply whatever it was to the actual flash bytes.
      this.applyCommand();
    }
    this.csAsserted = nowAsserted;
  };

  /**
   * One SPI clock's worth of full-duplex exchange: `byteOut` is being shifted into the (virtual)
   * flash chip, and this returns whatever it shifts back out in response. Only WRITE_ENABLE/
   * WRITE_DISABLE take effect immediately (single-byte commands, nothing to wait for);
   * erase/program are deferred to applyCommand() at chip-select deassert, since real flash chips
   * apply them atomically once the whole command+address+data has been clocked in, not
   * byte-by-byte as they arrive.
   */
  private shiftByte(byteOut: number): number {
    this.txBuffer.push(byteOut);
    const pos = this.txBuffer.length - 1;
    const opcode = this.txBuffer[0];

    if (pos === 0) {
      if (opcode === CMD_WRITE_ENABLE) {
        this.writeEnabled = true;
      } else if (opcode === CMD_WRITE_DISABLE) {
        this.writeEnabled = false;
      }
      return 0xff;
    }

    if (opcode === CMD_READ_STATUS_1) {
      return this.writeEnabled ? STATUS_WEL_BIT : 0;
    }

    if (opcode === CMD_READ_STATUS_2) {
      return STATUS2_QE_BIT;
    }

    if (opcode === CMD_WRITE_STATUS) {
      return 0; // accepted and ignored - see STATUS2_QE_BIT above
    }

    if (opcode === CMD_READ_JEDEC_ID) {
      const index = pos - 1;
      return index < JEDEC_ID.length ? JEDEC_ID[index] : 0;
    }

    if (opcode === CMD_READ_DATA && pos >= 4) {
      const address = this.addressFromBuffer();
      const target = address + (pos - 4);
      const { flash } = this.rp2040;
      return target >= 0 && target < flash.length ? flash[target] : 0xff;
    }

    // Unrecognized opcode (e.g. a dummy/mode-continuation byte in a quad-I/O read sequence, or a
    // probe this peripheral doesn't need to model): 0xFF, not 0x00 - matching what a real
    // floating/idle SPI bus reads back, the least likely value to look like "a real but wrong"
    // answer to whatever's checking it.
    return 0xff;
  }

  private addressFromBuffer(): number {
    const buf = this.txBuffer;
    return (buf[1] << 16) | (buf[2] << 8) | buf[3];
  }

  private applyCommand(): void {
    if (this.txBuffer.length === 0) {
      return;
    }
    const opcode = this.txBuffer[0];
    const { flash } = this.rp2040;

    if ((opcode === CMD_SECTOR_ERASE || opcode === CMD_BLOCK_ERASE) && this.txBuffer.length >= 4) {
      if (this.writeEnabled) {
        const size = opcode === CMD_SECTOR_ERASE ? FLASH_SECTOR_SIZE : FLASH_BLOCK_SIZE;
        const address = this.addressFromBuffer() & ~(size - 1);
        flash.fill(0xff, address, address + size);
      }
      this.writeEnabled = false;
    } else if (opcode === CMD_PAGE_PROGRAM && this.txBuffer.length > 4) {
      if (this.writeEnabled) {
        const address = this.addressFromBuffer();
        const data = this.txBuffer.slice(4, 4 + FLASH_PAGE_SIZE);
        for (let i = 0; i < data.length; i++) {
          const target = address + i;
          if (target >= 0 && target < flash.length) {
            // NOR flash program can only clear bits (1 -> 0), never set them - AND rather than
            // overwrite, matching real hardware (and catching software that programs without
            // erasing first the same way real flash would).
            flash[target] &= data[i];
          }
        }
      }
      this.writeEnabled = false;
    } else if (opcode === CMD_WRITE_STATUS) {
      this.writeEnabled = false;
    }

    this.txBuffer = [];
  }
}
