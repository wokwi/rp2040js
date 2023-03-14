import { IClockTimer } from '../clock/clock';
import { MAX_HARDWARE_IRQ } from '../irq';
import { BasePeripheral, Peripheral } from './peripheral';

export const CPUID = 0xd00;
export const ICSR = 0xd04;
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

/** ICSR Bits */
const NMIPENDSET = 1 << 31;
const PENDSVSET = 1 << 28;
const PENDSVCLR = 1 << 27;
const PENDSTSET = 1 << 26;
const PENDSTCLR = 1 << 25;
const ISRPREEMPT = 1 << 23;
const ISRPENDING = 1 << 22;
const VECTPENDING_MASK = 0x1ff;
const VECTPENDING_SHIFT = 12;
const VECTACTIVE_MASK = 0x1ff;
const VECTACTIVE_SHIFT = 0;

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
    const { core } = rp2040;

    switch (offset) {
      case CPUID:
        return 0x410cc601; /* Verified against actual hardware */

      case ICSR: {
        const pendingInterrupts =
          core.pendingInterrupts || core.pendingPendSV || core.pendingSystick || core.pendingSVCall;
        const vectPending = core.vectPending;
        return (
          (core.pendingNMI ? NMIPENDSET : 0) |
          (core.pendingPendSV ? PENDSVSET : 0) |
          (core.pendingSystick ? PENDSTSET : 0) |
          (pendingInterrupts ? ISRPENDING : 0) |
          (vectPending << VECTPENDING_SHIFT) |
          ((core.IPSR & VECTACTIVE_MASK) << VECTACTIVE_SHIFT)
        );
      }

      case VTOR:
        return core.VTOR;

      /* NVIC */
      case NVIC_ISPR:
        return core.pendingInterrupts >>> 0;
      case NVIC_ICPR:
        return core.pendingInterrupts >>> 0;
      case NVIC_ISER:
        return core.enabledInterrupts >>> 0;
      case NVIC_ICER:
        return core.enabledInterrupts >>> 0;

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
          for (let priority = 0; priority < core.interruptPriorities.length; priority++) {
            if (core.interruptPriorities[priority] & (1 << interruptNumber)) {
              result |= priority << (8 * byteIndex + 6);
            }
          }
        }
        return result;
      }

      case SHPR2:
        return core.SHPR2;
      case SHPR3:
        return core.SHPR3;

      /* SysTick */
      case SYST_CSR: {
        const countFlagValue = this.systickCountFlag ? 1 << 16 : 0;
        this.systickCountFlag = false;
        return countFlagValue | (this.systickControl & 0x7);
      }
      case SYST_CVR: {
        const delta = (rp2040.core.cycles - this.systickLastZero) % (this.systickReload + 1);
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
    const { core } = rp2040;

    const hardwareInterruptMask = (1 << MAX_HARDWARE_IRQ) - 1;

    switch (offset) {
      case ICSR:
        if (value & NMIPENDSET) {
          core.pendingNMI = true;
          core.interruptsUpdated = true;
        }
        if (value & PENDSVSET) {
          core.pendingPendSV = true;
          core.interruptsUpdated = true;
        }
        if (value & PENDSVCLR) {
          core.pendingPendSV = false;
        }
        if (value & PENDSTSET) {
          core.pendingSystick = true;
          core.interruptsUpdated = true;
        }
        if (value & PENDSTCLR) {
          core.pendingSystick = false;
        }
        return;

      case VTOR:
        core.VTOR = value;
        return;

      /* NVIC */
      case NVIC_ISPR:
        core.pendingInterrupts |= value;
        core.interruptsUpdated = true;
        return;
      case NVIC_ICPR:
        core.pendingInterrupts &= ~value | hardwareInterruptMask;
        return;
      case NVIC_ISER:
        core.enabledInterrupts |= value;
        core.interruptsUpdated = true;
        return;
      case NVIC_ICER:
        core.enabledInterrupts &= ~value;
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
          for (let priority = 0; priority < core.interruptPriorities.length; priority++) {
            core.interruptPriorities[priority] &= ~(1 << interruptNumber);
          }
          core.interruptPriorities[newPriority] |= 1 << interruptNumber;
        }
        core.interruptsUpdated = true;
        return;
      }

      case SHPR2:
        core.SHPR2 = value;
        return;
      case SHPR3:
        core.SHPR3 = value;
        return;

      // SysTick
      case SYST_CSR:
        {
          const prevInterrupt = this.systickControl === 0x7;
          const interrupt = value === 0x7;
          if (interrupt && !prevInterrupt) {
            // TODO: adjust the timer based on the current systick value
            const systickCallback = () => {
              core.pendingSystick = true;
              core.interruptsUpdated = true;
              if (core.waiting && core.checkForInterrupts()) {
                core.waiting = false;
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
