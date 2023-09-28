import { describe, expect, it } from 'vitest';
import { RP2040 } from '..';
import { MockClock } from '../clock/mock-clock';
import { bit } from '../utils/bit';

const CH2_WRITE_ADDR = 0x50000084;
const CH2_TRANS_COUNT = 0x50000088;
const CH2_AL1_CTRL = 0x50000090;
const CH2_AL3_READ_ADDR_TRIG = 0x500000bc;
const CH6_READ_ADDR = 0x50000180;
const CH6_WRITE_ADDR = 0x50000184;
const CH6_TRANS_COUNT = 0x50000188;
const CH6_CTRL_TRIG = 0x5000018c;
const INTR = 0x50000400;

const EN = bit(0);
const DATA_SIZE_SHIFT = 2;
const INCR_WRITE = bit(5);
const INCR_READ = bit(4);
const CHAIN_TO_SHIFT = 11;
const TREQ_SEL_SHIFT = 15;
const BUSY = bit(24);

const TREQ_PERMANENT = 0x3f;

describe('DMA', () => {
  it('should support DMA channel chaining', () => {
    const clock = new MockClock();
    const cpu = new RP2040(clock);

    // This test uses DMA to copy 4 chunks of 8-byte data, located in different memory areas, into a single memory area.
    // We use two DMA channels, 2 and 6 (numbers are arbitrary).
    // All the RAM addresses below are arbitrary:
    const CHUNKS_ADDR = [0x20001000, 0x20001100, 0x20002200, 0x20002300];
    const DEST_ADDR = 0x20008000;
    const DMA_CONTROL_BLOCK_ADDR = 0x2000a000;

    // Write the data to be copied, split into four chunks:
    cpu.writeUint32(CHUNKS_ADDR[0], 0x10);
    cpu.writeUint32(CHUNKS_ADDR[0] + 4, 0x20);
    cpu.writeUint32(CHUNKS_ADDR[1], 0x30);
    cpu.writeUint32(CHUNKS_ADDR[1] + 4, 0x40);
    cpu.writeUint32(CHUNKS_ADDR[2], 0x50);
    cpu.writeUint32(CHUNKS_ADDR[2] + 4, 0x60);
    cpu.writeUint32(CHUNKS_ADDR[3], 0x70);
    cpu.writeUint32(CHUNKS_ADDR[3] + 4, 0x80);

    // Write the source addresses into a DMA control block:
    cpu.writeUint32(DMA_CONTROL_BLOCK_ADDR, CHUNKS_ADDR[0]);
    cpu.writeUint32(DMA_CONTROL_BLOCK_ADDR + 4, CHUNKS_ADDR[1]);
    cpu.writeUint32(DMA_CONTROL_BLOCK_ADDR + 8, CHUNKS_ADDR[2]);
    cpu.writeUint32(DMA_CONTROL_BLOCK_ADDR + 12, CHUNKS_ADDR[3]);
    cpu.writeUint32(DMA_CONTROL_BLOCK_ADDR + 16, 0); // This marks the end of the chain

    // Channel 2 is used to copy the 8-byte chunks. Configure it:
    cpu.writeUint32(CH2_WRITE_ADDR, DEST_ADDR);
    cpu.writeUint32(CH2_TRANS_COUNT, 2); // 2 transfers of 4 bytes each = 8 bytes
    cpu.writeUint32(
      CH2_AL1_CTRL,
      EN |
        (6 << CHAIN_TO_SHIFT) |
        INCR_WRITE |
        INCR_READ |
        (TREQ_PERMANENT << TREQ_SEL_SHIFT) |
        (2 << DATA_SIZE_SHIFT)
    );

    // Channel 6 is used to control channel 2:
    cpu.writeUint32(CH6_WRITE_ADDR, CH2_AL3_READ_ADDR_TRIG);
    cpu.writeUint32(CH6_READ_ADDR, DMA_CONTROL_BLOCK_ADDR);
    cpu.writeUint32(CH6_TRANS_COUNT, 1); // we'll copy one word at a time
    cpu.writeUint32(
      CH6_CTRL_TRIG,
      EN | INCR_READ | (TREQ_PERMANENT << TREQ_SEL_SHIFT) | (2 << DATA_SIZE_SHIFT)
    );

    expect(cpu.readUint32(CH6_CTRL_TRIG) & BUSY).toEqual(BUSY);

    // Now the DMA transfer should be running. Skip some clock cycles, allowing it to finish:
    clock.advance(32);

    // Check that the transfer has indeed completed
    expect(cpu.readUint32(CH2_AL3_READ_ADDR_TRIG)).toEqual(0);
    expect(cpu.readUint32(CH2_AL1_CTRL) & BUSY).toEqual(0);
    expect(cpu.readUint32(CH6_CTRL_TRIG) & BUSY).toEqual(0);
    expect(cpu.readUint32(INTR)).toEqual(bit(2) | bit(6));

    // Assert that the data was copied correctly:
    expect(cpu.readUint16(DEST_ADDR + 0)).toEqual(0x10);
    expect(cpu.readUint16(DEST_ADDR + 4)).toEqual(0x20);
    expect(cpu.readUint16(DEST_ADDR + 8)).toEqual(0x30);
    expect(cpu.readUint16(DEST_ADDR + 12)).toEqual(0x40);
    expect(cpu.readUint16(DEST_ADDR + 16)).toEqual(0x50);
    expect(cpu.readUint16(DEST_ADDR + 20)).toEqual(0x60);
    expect(cpu.readUint16(DEST_ADDR + 24)).toEqual(0x70);
    expect(cpu.readUint16(DEST_ADDR + 28)).toEqual(0x80);
    expect(cpu.readUint16(DEST_ADDR + 32)).toEqual(0x0);
  });
});
