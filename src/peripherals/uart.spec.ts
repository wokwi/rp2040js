import { RP2040 } from '../rp2040';
import { RPUART } from './uart';

const OFFSET_UARTLCR_H = 0x2c;

describe('UART', () => {
  it('should correctly return wordLength based on UARTLCR_H value', () => {
    const rp2040 = new RP2040();
    const uart = new RPUART(rp2040, 'UART', 0, 0);
    uart.writeUint32(OFFSET_UARTLCR_H, 0x70);
    expect(uart.wordLength).toEqual(8);
  });
});
