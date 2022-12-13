import { RP2040 } from './rp2040';
import { Core } from './core';

//HARDWARE DIVIDER
const DIV_UDIVIDEND = 0x060; //  Divider unsigned dividend
const DIV_UDIVISOR = 0x064; //  Divider unsigned divisor
const DIV_SDIVIDEND = 0x068; //  Divider signed dividend
const DIV_SDIVISOR = 0x06c; //  Divider signed divisor
const DIV_QUOTIENT = 0x070; //  Divider result quotient
const DIV_REMAINDER = 0x074; //Divider result remainder
const DIV_CSR = 0x078;

export class RPSIOCore {
    divDividend = 0;
    divDivisor = 1;
    divQuotient = 0;
    divRemainder = 0;
    divCSR = 0;

    constructor(private readonly rp2040: RP2040) {

    }

    readUint32(offset: number) {
        switch (offset) {
            case DIV_UDIVIDEND:
                return this.divDividend;
            case DIV_SDIVIDEND:
                return this.divDividend;
            case DIV_UDIVISOR:
                return this.divDivisor;
            case DIV_SDIVISOR:
                return this.divDivisor;
            case DIV_QUOTIENT:
                this.divCSR &= ~0b10;
                return this.divQuotient;
            case DIV_REMAINDER:
                return this.divRemainder;
            case DIV_CSR:
                return this.divCSR;
            default:
                console.warn(`Read from invalid SIO address: ${offset.toString(16)}`);
                return 0xffffffff;
        }
    }

    writeUint32(offset: number, value: number, core: Core) {
        switch (offset) {
            case DIV_UDIVIDEND:
                this.divDividend = value;
                this.updateHardwareDivider(false, core);
                break;
            case DIV_SDIVIDEND:
                this.divDividend = value;
                this.updateHardwareDivider(true, core);
                break;
            case DIV_UDIVISOR:
                this.divDivisor = value;
                this.updateHardwareDivider(false, core);
                break;
            case DIV_SDIVISOR:
                this.divDivisor = value;
                this.updateHardwareDivider(true, core);
                break;
            case DIV_QUOTIENT:
                this.divQuotient = value;
                this.divCSR = 0b11;
                break;
            case DIV_REMAINDER:
                this.divRemainder = value;
                this.divCSR = 0b11;
                break;
            default:
                console.warn(
                    `Write to invalid SIO address: ${offset.toString(16)}, value=${value.toString(16)}`
                );
                break;
        }
    }

    private updateHardwareDivider(signed: boolean, core: Core) {
        if (this.divDivisor == 0) {
            this.divQuotient = this.divDividend > 0 ? -1 : 1;
            this.divRemainder = this.divDividend;
        } else {
            if (signed) {
                this.divQuotient = (this.divDividend | 0) / (this.divDivisor | 0);
                this.divRemainder = (this.divDividend | 0) % (this.divDivisor | 0);
            } else {
                this.divQuotient = (this.divDividend >>> 0) / (this.divDivisor >>> 0);
                this.divRemainder = (this.divDividend >>> 0) % (this.divDivisor >>> 0);
            }
        }
        this.divCSR = 0b11;
        switch (core) {
            case Core.Core0:
                this.rp2040.core0.cycles += 8;
                break;
            case Core.Core1:
                this.rp2040.core1.cycles += 8;
                break;
        }
    }
}