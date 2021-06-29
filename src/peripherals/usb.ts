import { BasePeripheral } from './peripheral';

const USBCTRL_IRQ = 5;

const MAIN_CTRL = 0x40;
const SIE_STATUS = 0x50;
const INTR = 0x8c;
const INTE = 0x90;
const INTF = 0x94;
const INTS = 0x98;

// MAIN_CTRL bits
const SIM_TIMING = 1 << 31;
const HOST_NDEVICE = 1 << 1;
const CONTROLLER_EN = 1 << 0;

// SIE_STATUS bits
const SIE_DATA_SEQ_ERROR = 1 << 31;
const SIE_ACK_REC = 1 << 30;
const SIE_STALL_REC = 1 << 29;
const SIE_NAK_REC = 1 << 28;
const SIE_RX_TIMEOUT = 1 << 27;
const SIE_RX_OVERFLOW = 1 << 26;
const SIE_BIT_STUFF_ERROR = 1 << 25;
const SIE_CRC_ERROR = 1 << 24;
const SIE_BUS_RESET = 1 << 19;
const SIE_TRANS_COMPLETE = 1 << 18;
const SIE_SETUP_REC = 1 << 17;
const SIE_CONNECTED = 1 << 16;
const SIE_RESUME = 1 << 11;
const SIE_VBUS_OVER_CURR = 1 << 10;
const SIE_SPEED = 1 << 9;
const SIE_SUSPENDED = 1 << 4;
const SIE_LINE_STATE = 1 << 3;
const SIE_VBUS_DETECTED = 1 << 0;

const SIE_WRITECLEAR_MASK =
  SIE_DATA_SEQ_ERROR |
  SIE_ACK_REC |
  SIE_STALL_REC |
  SIE_NAK_REC |
  SIE_RX_TIMEOUT |
  SIE_RX_OVERFLOW |
  SIE_BIT_STUFF_ERROR |
  SIE_CRC_ERROR |
  SIE_BUS_RESET |
  SIE_TRANS_COMPLETE |
  SIE_SETUP_REC |
  SIE_RESUME;

export class RPUSBController extends BasePeripheral {
  private mainCtrl = 0;
  private intRaw = 0;
  private intEnable = 0;
  private intForce = 0;
  private sieStatus = 0;
  private deviceConfigured = false;

  get intStatus() {
    return (this.intRaw & this.intEnable) | this.intForce;
  }

  readUint32(offset: number) {
    switch (offset) {
      case MAIN_CTRL:
        return this.mainCtrl;
      case SIE_STATUS:
        return this.sieStatus;
      case INTR:
        return this.intRaw;
      case INTE:
        return this.intEnable;
      case INTF:
        return this.intForce;
      case INTS:
        return this.intStatus;
    }
    return super.readUint32(offset);
  }

  writeUint32(offset: number, value: number) {
    switch (offset) {
      case MAIN_CTRL:
        this.mainCtrl = value & (SIM_TIMING | CONTROLLER_EN | HOST_NDEVICE);
        if (value & CONTROLLER_EN && !(value & HOST_NDEVICE)) {
          this.resetDevice();
        }
        break;
      case SIE_STATUS:
        this.sieStatus &= ~(this.rawWriteValue & SIE_WRITECLEAR_MASK);
        this.sieStatusUpdated();
        if (this.rawWriteValue & SIE_BUS_RESET) {
          this.setDeviceAddress(1);
        }
        if (this.rawWriteValue & SIE_SETUP_REC) {
          if (!this.deviceConfigured) {
            this.setDeviceConfiguration(1);
          }
        }
        break;
      case INTE:
        this.intEnable = value & 0xfffff;
        this.checkInterrupts();
        break;
      case INTF:
        this.intForce = value & 0xfffff;
        this.checkInterrupts();
        break;

      default:
        super.writeUint32(offset, value);
    }
  }

  private checkInterrupts() {
    const { intStatus } = this;
    this.rp2040.setInterrupt(USBCTRL_IRQ, !!intStatus);
  }

  private resetDevice() {
    this.deviceConfigured = false;
    this.sieStatus |= SIE_BUS_RESET;
    this.sieStatusUpdated();
  }

  private setDeviceAddress(address: number) {
    // TODO: write USB setup packet to 0x50100000, use the provided address
    this.sieStatus |= SIE_SETUP_REC;
    this.sieStatusUpdated();
  }

  private setDeviceConfiguration(cfgNum: number) {
    // TODO: write USB setup packet to 0x50100000, use the provided configuration number
    this.sieStatus |= SIE_SETUP_REC;
    this.sieStatusUpdated();
    this.deviceConfigured = true;
  }

  private sieStatusUpdated() {
    const intRegisterMap = [
      [SIE_SETUP_REC, 1 << 16],
      [SIE_RESUME, 1 << 15],
      [SIE_SUSPENDED, 1 << 14],
      [SIE_CONNECTED, 1 << 13],
      [SIE_BUS_RESET, 1 << 12],
      [SIE_VBUS_DETECTED, 1 << 11],
      [SIE_STALL_REC, 1 << 10],
      [SIE_CRC_ERROR, 1 << 9],
      [SIE_BIT_STUFF_ERROR, 1 << 8],
      [SIE_RX_OVERFLOW, 1 << 7],
      [SIE_RX_TIMEOUT, 1 << 6],
      [SIE_DATA_SEQ_ERROR, 1 << 5],
    ];
    for (const [sieBit, intRawBit] of intRegisterMap) {
      if (this.sieStatus & sieBit) {
        this.intRaw |= intRawBit;
      } else {
        this.intRaw &= ~intRawBit;
      }
    }
    this.checkInterrupts();
  }
}
