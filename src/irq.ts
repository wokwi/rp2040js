export enum IRQ {
  IO_BANK0 = 13,
  UART0 = 20,
  UART1 = 21,
  RTC = 25,
}

export const MAX_HARDWARE_IRQ = IRQ.RTC;
