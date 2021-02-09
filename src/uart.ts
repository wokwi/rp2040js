import { RP2040 } from './rp2040';

export const UART0_BASE = 0x40034000;
export const UART1_BASE = 0x40038000;

const UARTDR = 0x0;
const UARTFR = 0x18;

export class RPUART {
  public onByte?: (value: number) => void;

  constructor(private mcu: RP2040, private baseAddress = UART0_BASE) {
    mcu.writeHooks.set(baseAddress + UARTDR, (address, value) => {
      this.onByte?.(value & 0xff);
    });
    mcu.readHooks.set(baseAddress + UARTFR, () => 0);
  }
}
