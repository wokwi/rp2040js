import { IClockTimer } from '../clock/clock';
import { MAX_HARDWARE_IRQ } from '../irq';
import { BasePeripheral, Peripheral } from './peripheral';

export const VTOR = 0xd08;
export const SHPR2 = 0xd1c;
export const SHPR3 = 0xd20;

const SYST_CSR = 0x010; // SysTick Control and Status Register
const SYST_RVR = 0x014; // SysTick Reload Value Register
const SYST_CVR = 0x018; // SysTick Current Value Register
const SYST_CALIB = 0x01c; // SysTick Calibration Value Register
const NVIC_ISER = 0x100; // Interrupt Set-Enable Register
const NVIC_ICER = 0x180; // Interrupt Clear-Enable Register
const NVIC_ISPR = 0x200; // Interrupt Set-Pending Register
const NVIC_ICPR = 0x280; // Interrupt Clear-Pending Register

// Interrupt priority registers:
const NVIC_IPR0 = 0x400;
const NVIC_IPR1 = 0x404;
const NVIC_IPR2 = 0x408;
const NVIC_IPR3 = 0x40c;
const NVIC_IPR4 = 0x410;
const NVIC_IPR5 = 0x414;
const NVIC_IPR6 = 0x418;
const NVIC_IPR7 = 0x41c;

/** PPB stands for Private Periphral Bus.
 * These are peripherals that are part of the ARM Cortex Core, and there's one copy for each processor core.
 *
 * Included peripheral: NVIC, SysTick timer
 */
export class RPPPB extends BasePeripheral implements Peripheral {
  // Systick
  systickCountFlag = false;
  systickControl = 0;
  systickLastZero = 0;
  systickReload = 0;
  systickTimer: IClockTimer | null = null;

  readUint32(offset: number) {
    const { rp2040 } = this;

    switch (offset) {
      case VTOR:
        return rp2040.VTOR;

      /* NVIC */
      case NVIC_ISPR:
        return rp2040.pendingInterrupts >>> 0;
      case NVIC_ICPR:
        return rp2040.pendingInterrupts >>> 0;
      case NVIC_ISER:
        return rp2040.enabledInterrupts >>> 0;
      case NVIC_ICER:
        return rp2040.enabledInterrupts >>> 0;

      case NVIC_IPR0:
      case NVIC_IPR1:
      case NVIC_IPR2:
      case NVIC_IPR3:
      case NVIC_IPR4:
      case NVIC_IPR5:
      case NVIC_IPR6:
      case NVIC_IPR7: {
        const regIndex = (offset - NVIC_IPR0) >> 2;
        let result = 0;
        for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
          const interruptNumber = regIndex * 4 + byteIndex;
          for (let priority = 0; priority < rp2040.interruptPriorities.length; priority++) {
            if (rp2040.interruptPriorities[priority] & (1 << interruptNumber)) {
              result |= priority << (8 * byteIndex + 6);
            }
          }
        }
        return result;
      }

      case SHPR2:
        return rp2040.SHPR2;
      case SHPR3:
        return rp2040.SHPR3;

      /* SysTick */
      case SYST_CSR: {
        const countFlagValue = this.systickCountFlag ? 1 << 16 : 0;
        this.systickCountFlag = false;
        return countFlagValue | (this.systickControl & 0x7);
      }
      case SYST_CVR: {
        const delta = (rp2040.clock.micros - this.systickLastZero) % (this.systickReload + 1);
        if (!delta) {
          return 0;
        }
        return this.systickReload - (delta - 1);
      }
      case SYST_RVR:
        return this.systickReload;
      case SYST_CALIB:
        return 0x0000270f;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    const { rp2040 } = this;

    const hardwareInterruptMask = (1 << MAX_HARDWARE_IRQ) - 1;

    switch (offset) {
      case VTOR:
        rp2040.VTOR = value;
        return;

      /* NVIC */
      case NVIC_ISPR:
        rp2040.pendingInterrupts |= value;
        rp2040.interruptsUpdated = true;
        return;
      case NVIC_ICPR:
        rp2040.pendingInterrupts &= ~value | hardwareInterruptMask;
        return;
      case NVIC_ISER:
        rp2040.enabledInterrupts |= value;
        rp2040.interruptsUpdated = true;
        return;
      case NVIC_ICER:
        rp2040.enabledInterrupts &= ~value;
        return;

      case NVIC_IPR0:
      case NVIC_IPR1:
      case NVIC_IPR2:
      case NVIC_IPR3:
      case NVIC_IPR4:
      case NVIC_IPR5:
      case NVIC_IPR6:
      case NVIC_IPR7: {
        const regIndex = (offset - NVIC_IPR0) >> 2;
        for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
          const interruptNumber = regIndex * 4 + byteIndex;
          const newPriority = (value >> (8 * byteIndex + 6)) & 0x3;
          for (let priority = 0; priority < rp2040.interruptPriorities.length; priority++) {
            rp2040.interruptPriorities[priority] &= ~(1 << interruptNumber);
          }
          rp2040.interruptPriorities[newPriority] |= 1 << interruptNumber;
        }
        rp2040.interruptsUpdated = true;
        return;
      }

      case SHPR2:
        rp2040.SHPR2 = value;
        return;
      case SHPR3:
        rp2040.SHPR3 = value;
        return;

      // SysTick
      case SYST_CSR:
        {
          const prevInterrupt = this.systickControl === 0x7;
          const interrupt = value === 0x7;
          if (interrupt && !prevInterrupt) {
            // TODO: adjust the timer based on the current systick value
            const systickCallback = () => {
              rp2040.pendingSystick = true;
              rp2040.interruptsUpdated = true;
              if (rp2040.waiting && rp2040.checkForInterrupts()) {
                rp2040.waiting = false;
              }
              this.systickTimer = rp2040.clock.createTimer(this.systickReload + 1, systickCallback);
            };
            this.systickTimer = rp2040.clock.createTimer(this.systickReload + 1, systickCallback);
          }
          if (prevInterrupt && interrupt) {
            if (this.systickTimer) {
              rp2040.clock.deleteTimer(this.systickTimer);
            }
            this.systickTimer = null;
          }
          this.systickControl = value & 0x7;
        }
        return;

      case SYST_CVR:
        this.warn(`SYSTICK CVR: not implemented yet, value=${value}`);
        return;
      case SYST_RVR:
        this.systickReload = value;
        return;

      default:
        super.writeUint32(offset, value);
    }
  }
}
