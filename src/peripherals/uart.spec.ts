import { describe, expect, it } from 'vitest';
import { RP2040 } from '../rp2040.js';
import { RPUART } from './uart.js';

const UARTIBRD = 0x24;
const UARTFBRD = 0x28;
const OFFSET_UARTLCR_H = 0x2c;

describe('UART', () => {
  it('should correctly return wordLength based on UARTLCR_H value', () => {
    const rp2040 = new RP2040();
    const uart = new RPUART(rp2040, 'UART', 0, { rx: 0, tx: 0 });
    uart.writeUint32(OFFSET_UARTLCR_H, 0x70);
    expect(uart.wordLength).toEqual(8);
  });

  it('should correctly calculate the baud rate based on UARTIBRD, UARTFBRD values', () => {
    const rp2040 = new RP2040();
    const uart = new RPUART(rp2040, 'UART', 0, { rx: 0, tx: 0 });
    uart.writeUint32(UARTIBRD, 67); // Values taken from example in section 4.2.7.1. of the datasheet
    uart.writeUint32(UARTFBRD, 52);
    expect(uart.baudRate).toEqual(115207);
  });
});
