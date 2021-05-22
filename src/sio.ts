import { RP2040 } from './rp2040';

const CPUID = 0x000;

// GPIO
const GPIO_IN = 0x004; // Input value for GPIO pins
const GPIO_HI_IN = 0x008; // Input value for QSPI pins
const GPIO_OUT = 0x010; // GPIO output value
const GPIO_OUT_SET = 0x014; // GPIO output value set
const GPIO_OUT_CLR = 0x018; // GPIO output value clear
const GPIO_OUT_XOR = 0x01c; // GPIO output value XOR
const GPIO_OE = 0x020; // GPIO output enable
const GPIO_OE_SET = 0x024; // GPIO output enable set
const GPIO_OE_CLR = 0x028; // GPIO output enable clear
const GPIO_OE_XOR = 0x02c; // GPIO output enable XOR
const GPIO_HI_OUT = 0x030; // QSPI output value
const GPIO_HI_OUT_SET = 0x034; // QSPI output value set
const GPIO_HI_OUT_CLR = 0x038; // QSPI output value clear
const GPIO_HI_OUT_XOR = 0x03c; // QSPI output value XOR
const GPIO_HI_OE = 0x040; // QSPI output enable
const GPIO_HI_OE_SET = 0x044; // QSPI output enable set
const GPIO_HI_OE_CLR = 0x048; // QSPI output enable clear
const GPIO_HI_OE_XOR = 0x04c; // QSPI output enable XOR

const GPIO_MASK = 0x3fffffff;

//HARDWARE DIVIDER
const DIV_UDIVIDEND = 0x060; //  Divider unsigned dividend
const DIV_UDIVISOR = 0x064; //  Divider unsigned divisor
const DIV_SDIVIDEND = 0x068; //  Divider signed dividend
const DIV_SDIVISOR = 0x06c; //  Divider signed divisor
const DIV_QUOTIENT = 0x070; //  Divider result quotient
const DIV_REMAINDER = 0x074; //Divider result remainder
const DIV_CSR = 0x078;

export class RPSIO {
  gpioValue = 0;
  gpioOutputEnable = 0;
  qspiGpioValue = 0;
  qspiGpioOutputEnable = 0;
  divDividend = 0;
  divDivisor = 1;
  divQuotient = 0;
  divRemainder = 0;
  divCSR = 0;

  constructor(private readonly rp2040: RP2040) {}

  readUint32(offset: number) {
    switch (offset) {
      case GPIO_IN:
        return 0; // TODO implement!
      case GPIO_HI_IN:
        return 0; // TODO implement!
      case GPIO_OUT:
        return this.gpioValue;
      case GPIO_OE:
        return this.gpioOutputEnable;
      case GPIO_HI_OUT:
        return this.qspiGpioValue;
      case GPIO_HI_OE:
        return this.qspiGpioOutputEnable;
      case GPIO_OUT_SET:
      case GPIO_OUT_CLR:
      case GPIO_OUT_XOR:
      case GPIO_OE_SET:
      case GPIO_OE_CLR:
      case GPIO_OE_XOR:
      case GPIO_HI_OUT_SET:
      case GPIO_HI_OUT_CLR:
      case GPIO_HI_OUT_XOR:
      case GPIO_HI_OE_SET:
      case GPIO_HI_OE_CLR:
      case GPIO_HI_OE_XOR:
        return 0; // TODO verify with silicone
      case CPUID:
        // Returns the current CPU core id (always 0 for now)
        return 0;
      case DIV_UDIVIDEND:
        return this.divDividend >>> 0;
      case DIV_SDIVIDEND:
        return this.divDividend | 0;
      case DIV_UDIVISOR:
        return this.divDivisor >>> 0;
      case DIV_SDIVISOR:
        return this.divDivisor | 0;
      case DIV_QUOTIENT:
        this.divCSR &= ~0b10;
        return this.divQuotient;
      case DIV_REMAINDER:
        return this.divRemainder;
      case DIV_CSR:
        return this.divCSR;
    }
    console.warn(`Read from invalid SIO address: ${offset.toString(16)}`);
    return 0xffffffff;
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case GPIO_OUT:
        this.gpioValue = value & GPIO_MASK;
        break;
      case GPIO_OUT_SET:
        this.gpioValue |= value & GPIO_MASK;
        break;
      case GPIO_OUT_CLR:
        this.gpioValue &= ~value;
        break;
      case GPIO_OUT_XOR:
        this.gpioValue ^= value & GPIO_MASK;
        break;
      case GPIO_OE:
        this.gpioOutputEnable = value & GPIO_MASK;
        break;
      case GPIO_OE_SET:
        this.gpioOutputEnable |= value & GPIO_MASK;
        break;
      case GPIO_OE_CLR:
        this.gpioOutputEnable &= ~value;
        break;
      case GPIO_OE_XOR:
        this.gpioOutputEnable ^= value & GPIO_MASK;
        break;
      case GPIO_HI_OUT:
        this.qspiGpioValue = value & GPIO_MASK;
        break;
      case GPIO_HI_OUT_SET:
        this.qspiGpioValue |= value & GPIO_MASK;
        break;
      case GPIO_HI_OUT_CLR:
        this.qspiGpioValue &= ~value;
        break;
      case GPIO_HI_OUT_XOR:
        this.qspiGpioValue ^= value & GPIO_MASK;
        break;
      case GPIO_HI_OE:
        this.qspiGpioOutputEnable = value & GPIO_MASK;
        break;
      case GPIO_HI_OE_SET:
        this.qspiGpioOutputEnable |= value & GPIO_MASK;
        break;
      case GPIO_HI_OE_CLR:
        this.qspiGpioOutputEnable &= ~value;
        break;
      case GPIO_HI_OE_XOR:
        this.qspiGpioOutputEnable ^= value & GPIO_MASK;
        break;
      case DIV_UDIVIDEND:
        this.divDividend = value >>> 0;
        this.divCSR = 0b10;
        this.divQuotient = Math.trunc(this.divDividend / this.divDivisor) >>> 0;
        this.divRemainder = Math.trunc(this.divDividend % this.divDivisor) >>> 0;
        this.divCSR = 0b11;
        this.rp2040.cycles += 8;
        break;
      case DIV_SDIVIDEND:
        this.divDividend = value | 0;
        this.divCSR = 0b10;
        this.divQuotient = Math.trunc(this.divDividend / this.divDivisor) | 0;
        this.divRemainder = Math.trunc(this.divDividend % this.divDivisor) | 0;
        this.divCSR = 0b11;
        this.rp2040.cycles += 8;
        break;
      case DIV_UDIVISOR:
        this.divDivisor = value >>> 0;
        this.divCSR = 0b10;
        if (this.divDivisor == 0) {
          this.divQuotient = 0xffffffff;
          this.divRemainder = this.divDividend;
        } else {
          this.divQuotient = Math.trunc(this.divDividend / this.divDivisor) >>> 0;
          this.divRemainder = Math.trunc(this.divDividend % this.divDivisor) >>> 0;
        }
        this.divCSR = 0b11;
        this.rp2040.cycles += 8;
        break;
      case DIV_SDIVISOR:
        this.divCSR = 0b10;
        this.divDivisor = value | 0;
        if (this.divDivisor == 0) {
          this.divQuotient = 0xffffffff;
          this.divRemainder = this.divDividend;
        } else {
          this.divQuotient = Math.trunc(this.divDividend / this.divDivisor) | 0;
          this.divRemainder = Math.trunc(this.divDividend % this.divDivisor) | 0;
        }
        this.divCSR = 0b11;
        this.rp2040.cycles += 8;
        break;
      case DIV_QUOTIENT:
        this.divQuotient = value;
        this.divCSR = 0b11;
        break;
      case DIV_REMAINDER:
        this.divRemainder = value;
        this.divCSR = 0b11;
        break;
    }
  }
}
