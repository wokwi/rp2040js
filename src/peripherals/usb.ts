import { IAlarm } from '../clock/clock.js';
import { IRQ } from '../irq.js';
import { RP2040 } from '../rp2040.js';
import {
  parseSetupPacket,
  StandardRequest,
  USBDevice,
  USBTransferResult,
} from '../usb/usb-device.js';
import { BasePeripheral } from './peripheral.js';

const ENDPOINT_COUNT = 16;
const USB_HOST_INTERRUPT_ENDPOINTS = 15;

// USB DPSRAM Registers - Device mode
const EP1_IN_CONTROL = 0x8;
const EP0_IN_BUFFER_CONTROL = 0x80;
const EP0_OUT_BUFFER_CONTROL = 0x84;
const EP15_OUT_BUFFER_CONTROL = 0xfc;

// USB DPRAM Registers - Host mode
// Host DPRAM layout (from pico-sdk hardware/structs/usb.h):
// 0x00-0x07: setup_packet (8 bytes)
// 0x08-0x7f: int_ep_ctrl[15] (15 × 8 bytes, ctrl + spare per entry)
// 0x80: epx_buf_ctrl (4 bytes)
// 0x84: _spare0 (4 bytes)
// 0x88-0xff: int_ep_buffer_ctrl[15] (15 × 8 bytes, ctrl + spare per entry)
// 0x100: epx_ctrl (4 bytes)
// 0x104-0x17f: _spare1 (124 bytes)
// 0x180+: epx_data buffer (up to end of DPRAM)
const HOST_SETUP_PACKET = 0x00;
const HOST_INT_EP_CTRL_BASE = 0x08; // int_ep_ctrl[0] at 0x08, stride 8
const HOST_INT_EP_BUF_CTRL_BASE = 0x88; // int_ep_buffer_ctrl[0] at 0x88, stride 8
const HOST_EPX_BUF_CTRL = 0x80;
const HOST_EPX_DATA = 0x180;

// Endpoint Control bits
const USB_CTRL_DOUBLE_BUF = 1 << 30;
const USB_CTRL_INTERRUPT_PER_TRANSFER = 1 << 29;
const EP_CTRL_ENABLE_BITS = 1 << 31;
const EP_CTRL_BUFFER_TYPE_LSB = 26;
const EP_CTRL_HOST_INTERRUPT_INTERVAL_LSB = 16;

// Buffer Control bits
const USB_BUF_CTRL_AVAILABLE = 1 << 10;
const USB_BUF_CTRL_FULL = 1 << 15;
const USB_BUF_CTRL_LEN_MASK = 0x3ff;
const USB_BUF_CTRL_DATA1_PID = 1 << 13;
const USB_BUF_CTRL_LAST = 1 << 14;
// Buffer1
const USB_BUF1_SHIFT = 16;
const USB_BUF1_OFFSET = 64;

// USB Peripheral Registers
const ADDR_ENDP = 0x0;
const ADDR_ENDP1 = 0x04;
const ADDR_ENDP15 = 0x3c;
const MAIN_CTRL = 0x40;
const SOF_WR = 0x44;
const SOF_RD = 0x48;
const SIE_CTRL = 0x4c;
const SIE_STATUS = 0x50;
const INT_EP_CTRL = 0x54;
const BUFF_STATUS = 0x58;
const BUFF_CPU_SHOULD_HANDLE = 0x5c;
const EP_ABORT = 0x60;
const EP_ABORT_DONE = 0x64;
const EP_STALL_ARM = 0x68;
const NAK_POLL = 0x6c;
const EP_STATUS_STALL_NAK = 0x70;
const USB_MUXING = 0x74;
const USB_PWR = 0x78;
const USBPHY_DIRECT = 0x7c;
const USBPHY_DIRECT_OVERRIDE = 0x80;
const USBPHY_TRIM = 0x84;
const INTR = 0x8c;
const INTE = 0x90;
const INTF = 0x94;
const INTS = 0x98;

// MAIN_CTRL bits
const SIM_TIMING = 1 << 31;
const HOST_NDEVICE = 1 << 1;
const CONTROLLER_EN = 1 << 0;

// SIE_CTRL bits (host mode)
const SIE_CTRL_EP0_INT_STALL = 1 << 31;
const SIE_CTRL_EP0_DOUBLE_BUF = 1 << 30;
const SIE_CTRL_EP0_INT_1BUF = 1 << 29;
const SIE_CTRL_EP0_INT_2BUF = 1 << 28;
const SIE_CTRL_EP0_INT_NAK = 1 << 27;
const SIE_CTRL_DIRECT_EN = 1 << 26;
const SIE_CTRL_DIRECT_DP = 1 << 25;
const SIE_CTRL_DIRECT_DM = 1 << 24;
const SIE_CTRL_TRANSCEIVER_PD = 1 << 18;
const SIE_CTRL_RPU_OPT = 1 << 17;
const SIE_CTRL_PULLUP_EN = 1 << 16;
const SIE_CTRL_PULLDOWN_EN = 1 << 15;
const SIE_CTRL_RESET_BUS = 1 << 13;
const SIE_CTRL_RESUME = 1 << 12;
const SIE_CTRL_VBUS_EN = 1 << 11;
const SIE_CTRL_KEEP_ALIVE_EN = 1 << 10;
const SIE_CTRL_SOF_EN = 1 << 9;
const SIE_CTRL_SOF_SYNC = 1 << 8;
const SIE_CTRL_PREAMBLE_EN = 1 << 6;
const SIE_CTRL_STOP_TRANS = 1 << 4;
const SIE_CTRL_RECEIVE_DATA = 1 << 3;
const SIE_CTRL_SEND_DATA = 1 << 2;
const SIE_CTRL_SEND_SETUP = 1 << 1;
const SIE_CTRL_START_TRANS = 1 << 0;

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
const SIE_SPEED_LS_VALUE = 1; // Low speed
const SIE_SPEED_FS_VALUE = 2; // Full speed
const SIE_SUSPENDED = 1 << 4;
const SIE_LINE_STATE_MASK = 0x3;
const SIE_LINE_STATE_SHIFT = 2;
const SIE_VBUS_DETECTED = 1 << 0;

// USB_MUXING bits
const SOFTCON = 1 << 3;
const TO_DIGITAL_PAD = 1 << 2;
const TO_EXTPHY = 1 << 1;
const TO_PHY = 1 << 0;

// USB_PWR bits
const PWR_VBUS_DETECT = 1 << 3;
const PWR_VBUS_DETECT_OVERRIDE_EN = 1 << 2;
const PWR_OVERCURR_DETECT = 1 << 1;
const PWR_OVERCURR_DETECT_EN = 1 << 0;

// INTR bits (directly from RP2040 datasheet)
const INTR_EP_STALL_NAK = 1 << 19;
const INTR_ABORT_DONE = 1 << 18;
const INTR_DEV_SOF = 1 << 17;
const INTR_SETUP_REQ = 1 << 16;
const INTR_DEV_RESUME_FROM_HOST = 1 << 15;
const INTR_DEV_SUSPEND = 1 << 14;
const INTR_DEV_CONN_DIS = 1 << 13;
const INTR_BUS_RESET = 1 << 12;
const INTR_VBUS_DETECT = 1 << 11;
const INTR_STALL = 1 << 10;
const INTR_ERROR_CRC = 1 << 9;
const INTR_ERROR_BIT_STUFF = 1 << 8;
const INTR_ERROR_RX_OVERFLOW = 1 << 7;
const INTR_ERROR_RX_TIMEOUT = 1 << 6;
const INTR_ERROR_DATA_SEQ = 1 << 5;
const INTR_BUFF_STATUS = 1 << 4;
const INTR_TRANS_COMPLETE = 1 << 3;
const INTR_HOST_SOF = 1 << 2;
const INTR_HOST_RESUME = 1 << 1;
const INTR_HOST_CONN_DIS = 1 << 0;

// SIE Line states
enum SIELineState {
  SE0 = 0b00,
  J = 0b01,
  K = 0b10,
  SE1 = 0b11,
}

const SIE_WRITECLEAR_MASK =
  SIE_DATA_SEQ_ERROR |
  SIE_ACK_REC |
  SIE_STALL_REC |
  SIE_NAK_REC |
  SIE_RX_TIMEOUT |
  SIE_RX_OVERFLOW |
  SIE_BIT_STUFF_ERROR |
  SIE_CONNECTED |
  SIE_CRC_ERROR |
  SIE_BUS_RESET |
  SIE_TRANS_COMPLETE |
  SIE_SETUP_REC |
  SIE_RESUME;

class USBEndpointAlarm {
  buffers: Uint8Array[] = [];

  constructor(readonly alarm: IAlarm) {}

  schedule(buffer: Uint8Array, delayNanos: number) {
    this.buffers.push(buffer);
    this.alarm.schedule(delayNanos);
  }
}

export class RPUSBController extends BasePeripheral {
  // Common registers
  private addrEndp = 0;
  private mainCtrl = 0;
  private intRaw = 0;
  private intEnable = 0;
  private intForce = 0;
  private sieStatus = 0;
  private buffStatus = 0;

  // Host mode registers
  private sieCtrl = 0;
  private sofFrameNumber = 0;
  private devAddrCtrl = 0; // Device address and endpoint for non-interrupt transfers
  private intEpAddrCtrl: number[] = new Array(USB_HOST_INTERRUPT_ENDPOINTS).fill(0);
  private intEpCtrl = 0; // Interrupt endpoint control (enable bits)
  private usbPwr = 0;
  private nakPoll = 0;
  private epAbort = 0;
  private epAbortDone = 0;
  private epStallArm = 0;
  private epStatusStallNak = 0;

  // Host mode state
  private hostMode = false;
  private sofEnabled = false;
  private connectedDevice: USBDevice | null = null;
  private pendingSetupResponse: Uint8Array | null = null;
  private controlDataPid = 1; // DATA0/DATA1 toggle for control transfers
  private expectingStatusPhase = false; // True when expecting IN status for control OUT

  // Alarms
  private readonly endpointReadAlarms: USBEndpointAlarm[];
  private readonly endpointWriteAlarms: USBEndpointAlarm[];
  private readonly resetAlarm: IAlarm;
  private readonly sofAlarm: IAlarm;
  private readonly hostTransactionAlarm: IAlarm;

  // Device mode callbacks
  onUSBEnabled?: () => void;
  onResetReceived?: () => void;
  onEndpointWrite?: (endpoint: number, buffer: Uint8Array) => void;
  onEndpointRead?: (endpoint: number, byteCount: number) => void;

  readDelayMicroseconds = 10;
  writeDelayMicroseconds = 10; // Determined empirically
  hostTransactionDelayMicroseconds = 5; // Host transaction delay

  get intStatus() {
    return (this.intRaw & this.intEnable) | this.intForce;
  }

  constructor(rp2040: RP2040, name: string) {
    super(rp2040, name);
    const clock = rp2040.clock;
    this.endpointReadAlarms = [];
    this.endpointWriteAlarms = [];
    for (let i = 0; i < ENDPOINT_COUNT; ++i) {
      this.endpointReadAlarms.push(
        new USBEndpointAlarm(
          clock.createAlarm(() => {
            const buffer = this.endpointReadAlarms[i].buffers.shift();
            if (buffer) {
              this.finishRead(i, buffer);
            }
          }),
        ),
      );
      this.endpointWriteAlarms.push(
        new USBEndpointAlarm(
          clock.createAlarm(() => {
            for (const buffer of this.endpointWriteAlarms[i].buffers) {
              this.onEndpointWrite?.(i, buffer);
            }
            this.endpointWriteAlarms[i].buffers = [];
          }),
        ),
      );
    }
    this.resetAlarm = clock.createAlarm(() => {
      this.sieStatus |= SIE_BUS_RESET;
      this.sieStatusUpdated();
    });

    // Host mode alarms
    this.sofAlarm = clock.createAlarm(() => {
      this.generateSOF();
    });
    this.hostTransactionAlarm = clock.createAlarm(() => {
      this.completeHostTransaction();
    });
  }

  readUint32(offset: number) {
    // Handle interrupt endpoint address registers (ADDR_ENDP1 through ADDR_ENDP15)
    if (offset >= ADDR_ENDP1 && offset <= ADDR_ENDP15 && (offset & 0x3) === 0) {
      const epIndex = (offset - ADDR_ENDP1) >> 2;
      return this.intEpAddrCtrl[epIndex];
    }

    switch (offset) {
      case ADDR_ENDP:
        return this.hostMode ? this.devAddrCtrl : this.addrEndp & 0b1111000000001111111;
      case MAIN_CTRL:
        return this.mainCtrl;
      case SOF_WR:
        return 0; // Write-only
      case SOF_RD:
        return this.sofFrameNumber & 0x7ff;
      case SIE_CTRL:
        return this.sieCtrl;
      case SIE_STATUS:
        // In host mode, reading SIE_STATUS acknowledges the connection event
        // Clear HOST_CONN_DIS interrupt once firmware reads the status
        if (this.hostMode && this.intRaw & INTR_HOST_CONN_DIS) {
          this.intRaw &= ~INTR_HOST_CONN_DIS;
          this.checkInterrupts();
        }
        return this.sieStatus;
      case INT_EP_CTRL:
        return this.intEpCtrl;
      case BUFF_STATUS:
        return this.buffStatus;
      case BUFF_CPU_SHOULD_HANDLE:
        return 0;
      case EP_ABORT:
        return this.epAbort;
      case EP_ABORT_DONE:
        return this.epAbortDone;
      case EP_STALL_ARM:
        return this.epStallArm;
      case NAK_POLL:
        return this.nakPoll;
      case EP_STATUS_STALL_NAK:
        return this.epStatusStallNak;
      case USB_PWR:
        return this.usbPwr;
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
    // Handle interrupt endpoint address registers (ADDR_ENDP1 through ADDR_ENDP15)
    if (offset >= ADDR_ENDP1 && offset <= ADDR_ENDP15 && (offset & 0x3) === 0) {
      const epIndex = (offset - ADDR_ENDP1) >> 2;
      this.intEpAddrCtrl[epIndex] = value;
      return;
    }

    switch (offset) {
      case ADDR_ENDP:
        if (this.hostMode) {
          this.devAddrCtrl = value;
        } else {
          this.addrEndp = value;
        }
        break;
      case MAIN_CTRL:
        this.mainCtrl = value & (SIM_TIMING | CONTROLLER_EN | HOST_NDEVICE);
        this.hostMode = !!(value & HOST_NDEVICE);
        if (value & CONTROLLER_EN) {
          if (this.hostMode) {
            this.debug('USB Host mode enabled');
            // In host mode, check if a device is already connected
            if (this.connectedDevice) {
              this.onDeviceConnected();
            }
          } else {
            this.onUSBEnabled?.();
          }
        }
        break;
      case SOF_WR:
        this.sofFrameNumber = value & 0x7ff;
        break;
      case SIE_CTRL:
        this.handleSieCtrlWrite(value);
        break;
      case INT_EP_CTRL:
        this.intEpCtrl = value;
        break;
      case BUFF_STATUS:
        this.buffStatus &= ~this.rawWriteValue;
        this.buffStatusUpdated();
        break;
      case EP_ABORT:
        this.epAbort = value;
        // Immediately mark as done
        this.epAbortDone |= value;
        break;
      case EP_ABORT_DONE:
        this.epAbortDone &= ~this.rawWriteValue;
        break;
      case EP_STALL_ARM:
        this.epStallArm = value;
        break;
      case NAK_POLL:
        this.nakPoll = value;
        break;
      case EP_STATUS_STALL_NAK:
        this.epStatusStallNak &= ~this.rawWriteValue;
        break;
      case USB_MUXING:
        // Workaround for busy wait in hw_enumeration_fix_force_ls_j() / hw_enumeration_fix_finish():
        if (value & TO_DIGITAL_PAD && !(value & TO_PHY)) {
          this.sieStatus |= SIE_CONNECTED;
        }
        break;
      case USB_PWR:
        this.usbPwr = value;
        // VBUS detect override - set VBUS detected in SIE_STATUS
        if (value & PWR_VBUS_DETECT_OVERRIDE_EN) {
          if (value & PWR_VBUS_DETECT) {
            this.sieStatus |= SIE_VBUS_DETECTED;
          } else {
            this.sieStatus &= ~SIE_VBUS_DETECTED;
          }
        }
        break;
      case SIE_STATUS:
        this.sieStatus &= ~(this.rawWriteValue & SIE_WRITECLEAR_MASK);
        if (this.rawWriteValue & SIE_BUS_RESET) {
          if (!this.hostMode) {
            this.onResetReceived?.();
          }
          this.sieStatus &= ~(SIE_LINE_STATE_MASK << SIE_LINE_STATE_SHIFT);
          this.sieStatus |= (SIELineState.J << SIE_LINE_STATE_SHIFT) | SIE_CONNECTED;
        }
        this.sieStatusUpdated();
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

  private readEndpointControlReg(endpoint: number, out: boolean) {
    const controlRegOffset = EP1_IN_CONTROL + 8 * (endpoint - 1) + (out ? 4 : 0);
    return this.rp2040.usbDPRAMView.getUint32(controlRegOffset, true);
  }

  private getEndpointBufferOffset(endpoint: number, out: boolean) {
    if (endpoint === 0) {
      return 0x100;
    }
    return this.readEndpointControlReg(endpoint, out) & 0xffc0;
  }

  DPRAMUpdated(offset: number, value: number) {
    // Skip device-mode buffer control handling in host mode
    if (this.hostMode) {
      return;
    }
    if (
      value & USB_BUF_CTRL_AVAILABLE &&
      offset >= EP0_IN_BUFFER_CONTROL &&
      offset <= EP15_OUT_BUFFER_CONTROL
    ) {
      const endpoint = (offset - EP0_IN_BUFFER_CONTROL) >> 3;
      const bufferOut = offset & 4 ? true : false;
      let doubleBuffer = false;
      let interrupt = true;
      if (endpoint != 0) {
        const control = this.readEndpointControlReg(endpoint, bufferOut);
        doubleBuffer = !!(control & USB_CTRL_DOUBLE_BUF);
        interrupt = !!(control & USB_CTRL_INTERRUPT_PER_TRANSFER);
      }

      if (doubleBuffer && (value >> USB_BUF1_SHIFT) & USB_BUF_CTRL_AVAILABLE) {
        const bufferLength = (value >> USB_BUF1_SHIFT) & USB_BUF_CTRL_LEN_MASK;
        const bufferOffset = this.getEndpointBufferOffset(endpoint, bufferOut) + USB_BUF1_OFFSET;
        this.debug(
          `Start USB transfer, endPoint=${endpoint}, direction=${
            bufferOut ? 'out' : 'in'
          } buffer=${bufferOffset.toString(16)} length=${bufferLength}`,
        );
        value &= ~(USB_BUF_CTRL_AVAILABLE << USB_BUF1_SHIFT);
        this.rp2040.usbDPRAMView.setUint32(offset, value, true);
        if (bufferOut) {
          this.onEndpointRead?.(endpoint, bufferLength);
        } else {
          value &= ~(USB_BUF_CTRL_FULL << USB_BUF1_SHIFT);
          this.rp2040.usbDPRAMView.setUint32(offset, value, true);
          const buffer = this.rp2040.usbDPRAM.slice(bufferOffset, bufferOffset + bufferLength);
          this.indicateBufferReady(endpoint, false);
          this.endpointWriteAlarms[endpoint].schedule(buffer, this.writeDelayMicroseconds * 1000);
        }
      }

      const bufferLength = value & USB_BUF_CTRL_LEN_MASK;
      const bufferOffset = this.getEndpointBufferOffset(endpoint, bufferOut);
      this.debug(
        `Start USB transfer, endPoint=${endpoint}, direction=${
          bufferOut ? 'out' : 'in'
        } buffer=${bufferOffset.toString(16)} length=${bufferLength}`,
      );
      value &= ~USB_BUF_CTRL_AVAILABLE;
      this.rp2040.usbDPRAMView.setUint32(offset, value, true);
      if (bufferOut) {
        this.onEndpointRead?.(endpoint, bufferLength);
      } else {
        value &= ~USB_BUF_CTRL_FULL;
        this.rp2040.usbDPRAMView.setUint32(offset, value, true);
        const buffer = this.rp2040.usbDPRAM.slice(bufferOffset, bufferOffset + bufferLength);
        if (interrupt || !doubleBuffer) {
          this.indicateBufferReady(endpoint, false);
        }
        this.endpointWriteAlarms[endpoint].schedule(buffer, this.writeDelayMicroseconds * 1000);
      }
    }
  }

  endpointReadDone(endpoint: number, buffer: Uint8Array, delay = this.readDelayMicroseconds) {
    this.endpointReadAlarms[endpoint].schedule(buffer, delay * 1000);
  }

  private finishRead(endpoint: number, buffer: Uint8Array) {
    const bufferOffset = this.getEndpointBufferOffset(endpoint, true);
    const bufControlReg = EP0_OUT_BUFFER_CONTROL + endpoint * 8;
    let bufControl = this.rp2040.usbDPRAMView.getUint32(bufControlReg, true);
    const requestedLength = bufControl & USB_BUF_CTRL_LEN_MASK;
    const newLength = Math.min(buffer.length, requestedLength);
    bufControl |= USB_BUF_CTRL_FULL;
    bufControl = (bufControl & ~USB_BUF_CTRL_LEN_MASK) | (newLength & USB_BUF_CTRL_LEN_MASK);
    this.rp2040.usbDPRAMView.setUint32(bufControlReg, bufControl, true);
    this.rp2040.usbDPRAM.set(buffer.subarray(0, newLength), bufferOffset);
    this.indicateBufferReady(endpoint, true);
  }

  private checkInterrupts() {
    const { intStatus } = this;
    this.rp2040.setInterrupt(IRQ.USBCTRL, !!intStatus);
  }

  resetDevice() {
    this.resetAlarm.schedule(10_000_000); // USB reset takes ~10ms
  }

  sendSetupPacket(setupPacket: Uint8Array) {
    this.rp2040.usbDPRAM.set(setupPacket);
    this.sieStatus |= SIE_SETUP_REC;
    this.sieStatusUpdated();
  }

  private indicateBufferReady(endpoint: number, out: boolean) {
    this.buffStatus |= 1 << (endpoint * 2 + (out ? 1 : 0));
    this.buffStatusUpdated();
  }

  private buffStatusUpdated() {
    if (this.buffStatus) {
      this.intRaw |= INTR_BUFF_STATUS;
    } else {
      this.intRaw &= ~INTR_BUFF_STATUS;
    }
    this.checkInterrupts();
  }

  private sieStatusUpdated() {
    if (this.hostMode) {
      // Host mode interrupt mapping
      const intRegisterMap = [
        [SIE_TRANS_COMPLETE, INTR_TRANS_COMPLETE],
        [SIE_STALL_REC, INTR_STALL],
        [SIE_CRC_ERROR, INTR_ERROR_CRC],
        [SIE_BIT_STUFF_ERROR, INTR_ERROR_BIT_STUFF],
        [SIE_RX_OVERFLOW, INTR_ERROR_RX_OVERFLOW],
        [SIE_RX_TIMEOUT, INTR_ERROR_RX_TIMEOUT],
        [SIE_DATA_SEQ_ERROR, INTR_ERROR_DATA_SEQ],
      ];
      for (const [sieBit, intRawBit] of intRegisterMap) {
        if (this.sieStatus & sieBit) {
          this.intRaw |= intRawBit;
        } else {
          this.intRaw &= ~intRawBit;
        }
      }
    } else {
      // Device mode interrupt mapping
      const intRegisterMap = [
        [SIE_SETUP_REC, INTR_SETUP_REQ],
        [SIE_RESUME, INTR_DEV_RESUME_FROM_HOST],
        [SIE_SUSPENDED, INTR_DEV_SUSPEND],
        [SIE_CONNECTED, INTR_DEV_CONN_DIS],
        [SIE_BUS_RESET, INTR_BUS_RESET],
        [SIE_VBUS_DETECTED, INTR_VBUS_DETECT],
        [SIE_STALL_REC, INTR_STALL],
        [SIE_CRC_ERROR, INTR_ERROR_CRC],
        [SIE_BIT_STUFF_ERROR, INTR_ERROR_BIT_STUFF],
        [SIE_RX_OVERFLOW, INTR_ERROR_RX_OVERFLOW],
        [SIE_RX_TIMEOUT, INTR_ERROR_RX_TIMEOUT],
        [SIE_DATA_SEQ_ERROR, INTR_ERROR_DATA_SEQ],
      ];
      for (const [sieBit, intRawBit] of intRegisterMap) {
        if (this.sieStatus & sieBit) {
          this.intRaw |= intRawBit;
        } else {
          this.intRaw &= ~intRawBit;
        }
      }
    }
    this.checkInterrupts();
  }

  // ============ Host Mode Methods ============

  /**
   * Connect a simulated USB device to the host controller.
   */
  connectDevice(device: USBDevice): void {
    this.connectedDevice = device;
    if (this.hostMode && this.mainCtrl & CONTROLLER_EN) {
      this.onDeviceConnected();
    }
  }

  /**
   * Disconnect the simulated USB device from the host controller.
   */
  disconnectDevice(): void {
    if (this.connectedDevice && this.hostMode) {
      this.connectedDevice = null;
      // Clear speed bits to indicate disconnection
      this.sieStatus &= ~(0x3 << 8); // Clear speed bits
      this.intRaw |= INTR_HOST_CONN_DIS;
      this.checkInterrupts();
    }
    this.connectedDevice = null;
  }

  private onDeviceConnected(): void {
    // Set full-speed device connected (value 2 in speed field, bits 9:8)
    this.sieStatus &= ~(0x3 << 8);
    this.sieStatus |= SIE_SPEED_FS_VALUE << 8;
    this.intRaw |= INTR_HOST_CONN_DIS;
    this.checkInterrupts();
    this.debug('USB device connected (full-speed)');
  }

  private handleSieCtrlWrite(value: number): void {
    this.sieCtrl = value;

    // Handle SOF enable/disable
    if (value & SIE_CTRL_SOF_EN && !this.sofEnabled) {
      this.sofEnabled = true;
      this.scheduleSofPacket();
      this.debug('SOF generation enabled');
    } else if (!(value & SIE_CTRL_SOF_EN) && this.sofEnabled) {
      this.sofEnabled = false;
      this.debug('SOF generation disabled');
    }

    // Handle bus reset
    if (value & SIE_CTRL_RESET_BUS) {
      this.debug('USB bus reset initiated');
      if (this.connectedDevice) {
        this.connectedDevice.onReset();
      }
      this.controlDataPid = 1; // Reset data toggle
    }

    // Handle start transaction
    if (value & SIE_CTRL_START_TRANS) {
      this.startHostTransaction();
    }
  }

  private scheduleSofPacket(): void {
    if (this.sofEnabled) {
      // SOF every 1ms = 1,000,000 ns
      this.sofAlarm.schedule(1_000_000);
    }
  }

  private generateSOF(): void {
    this.sofFrameNumber = (this.sofFrameNumber + 1) & 0x7ff;
    this.intRaw |= INTR_HOST_SOF;
    this.checkInterrupts();

    // Poll interrupt endpoints
    this.pollInterruptEndpoints();

    // Schedule next SOF
    this.scheduleSofPacket();
  }

  private pollInterruptEndpoints(): void {
    // Debug: log if any interrupt endpoints are enabled
    if (this.intEpCtrl && this.sofFrameNumber % 100 === 0) {
      this.debug(
        `INT_EP poll: intEpCtrl=0x${this.intEpCtrl.toString(16)} sofFrame=${this.sofFrameNumber}`,
      );
    }
    // Check each enabled interrupt endpoint
    for (let i = 0; i < USB_HOST_INTERRUPT_ENDPOINTS; i++) {
      const epCtrlBit = 1 << (i + 1);
      if (!(this.intEpCtrl & epCtrlBit)) continue;

      const addrEndp = this.intEpAddrCtrl[i];
      const devAddr = addrEndp & 0x7f;
      const epNum = (addrEndp >> 16) & 0xf;
      const isOut = !!(addrEndp & (1 << 25)); // INTEP_DIR bit

      // Debug: log endpoint config
      if (this.sofFrameNumber % 500 === 0) {
        this.debug(
          `INT_EP[${i}]: addrEndp=0x${addrEndp.toString(
            16,
          )} devAddr=${devAddr} epNum=${epNum} connectedAddr=${this.connectedDevice?.address}`,
        );
      }

      if (!this.connectedDevice || this.connectedDevice.address !== devAddr) continue;

      // Get the endpoint control register for interval checking
      const epCtrlOffset = HOST_INT_EP_CTRL_BASE + i * 8;
      const epCtrl = this.rp2040.usbDPRAMView.getUint32(epCtrlOffset, true);
      const interval = ((epCtrl >> EP_CTRL_HOST_INTERRUPT_INTERVAL_LSB) & 0x1ff) + 1;

      // Check if it's time to poll (simplified: poll every SOF for now)
      if (this.sofFrameNumber % interval !== 0) continue;

      // Get buffer control
      const bufCtrlOffset = HOST_INT_EP_BUF_CTRL_BASE + i * 8;
      const bufCtrl = this.rp2040.usbDPRAMView.getUint32(bufCtrlOffset, true);

      // Debug: log buffer status
      if (this.sofFrameNumber % 500 === 0) {
        this.debug(
          `INT_EP[${i}]: bufCtrl=0x${bufCtrl.toString(16)} available=${!!(
            bufCtrl & USB_BUF_CTRL_AVAILABLE
          )}`,
        );
      }

      // Only poll if buffer is available
      if (!(bufCtrl & USB_BUF_CTRL_AVAILABLE)) continue;

      // For IN endpoints, request data from device
      if (!isOut) {
        const epAddr = 0x80 | epNum; // IN endpoint
        const result = this.connectedDevice.handleDataIn(epAddr);

        if (result.status === 'ack' && result.data) {
          // Write data to the interrupt endpoint buffer
          const bufferOffset = epCtrl & 0xffc0;
          this.rp2040.usbDPRAM.set(result.data, bufferOffset);

          // Update buffer control
          let newBufCtrl = bufCtrl & ~USB_BUF_CTRL_AVAILABLE;
          newBufCtrl |= USB_BUF_CTRL_FULL;
          newBufCtrl =
            (newBufCtrl & ~USB_BUF_CTRL_LEN_MASK) | (result.data.length & USB_BUF_CTRL_LEN_MASK);
          this.rp2040.usbDPRAMView.setUint32(bufCtrlOffset, newBufCtrl, true);

          // Set buffer status for this interrupt endpoint
          // Interrupt EPs use bits 2+ in buff_status (bit 0 is epx IN, bit 1 is epx OUT)
          this.buffStatus |= 1 << ((i + 1) * 2);
          this.buffStatusUpdated();
        }
      }
    }
  }

  private startHostTransaction(): void {
    if (!this.hostMode) return;

    const devAddr = this.devAddrCtrl & 0x7f;
    const epNum = (this.devAddrCtrl >> 16) & 0xf;

    this.debug(
      `Host transaction: dev=${devAddr} ep=${epNum} sieCtrl=0x${this.sieCtrl.toString(16)}`,
    );

    if (!this.connectedDevice) {
      // No device connected - timeout
      this.sieStatus |= SIE_RX_TIMEOUT;
      this.sieStatusUpdated();
      return;
    }

    // Determine transaction type
    if (this.sieCtrl & SIE_CTRL_SEND_SETUP) {
      this.handleSetupTransaction(devAddr);
    } else if (this.sieCtrl & SIE_CTRL_RECEIVE_DATA) {
      this.handleInTransaction(devAddr, epNum);
    } else if (this.sieCtrl & SIE_CTRL_SEND_DATA) {
      this.handleOutTransaction(devAddr, epNum);
    }
  }

  private handleSetupTransaction(_devAddr: number): void {
    // Read setup packet from DPRAM
    const setupPacket = this.rp2040.usbDPRAM.slice(HOST_SETUP_PACKET, HOST_SETUP_PACKET + 8);
    const setup = parseSetupPacket(setupPacket);

    this.debug(
      `SETUP: bmRequestType=0x${setup.bmRequestType.toString(16)} bRequest=${
        setup.bRequest
      } wValue=0x${setup.wValue.toString(16)} wIndex=${setup.wIndex} wLength=${setup.wLength}`,
    );

    // Forward to device
    const result = this.connectedDevice!.handleSetupPacket(setupPacket);

    // Handle SET_ADDRESS specially
    if (setup.bRequest === StandardRequest.SetAddress && setup.type === 0) {
      const newAddr = setup.wValue & 0x7f;
      this.connectedDevice!.address = newAddr;
      this.connectedDevice!.onAddressAssigned?.(newAddr);
      this.debug(`Device address set to ${newAddr}`);
    }

    // Store response data for subsequent IN transaction
    if (setup.direction === 'in' && result.data) {
      this.pendingSetupResponse = result.data;
      this.expectingStatusPhase = false;
    } else {
      this.pendingSetupResponse = null;
      // Control OUT transfer - next IN will be status phase (zero-length ACK)
      this.expectingStatusPhase = true;
    }

    // Reset data toggle for data phase
    this.controlDataPid = 1;

    // SETUP always gets ACK (or STALL if error, but we handle that later)
    this.sieStatus |= SIE_ACK_REC;

    // Schedule transaction completion
    this.hostTransactionAlarm.schedule(this.hostTransactionDelayMicroseconds * 1000);
  }

  private handleInTransaction(devAddr: number, epNum: number): void {
    const epAddr = 0x80 | epNum;
    let result: USBTransferResult;

    if (epNum === 0 && this.expectingStatusPhase) {
      // Control OUT status phase - return zero-length ACK
      result = { status: 'ack', data: new Uint8Array(0) };
      this.expectingStatusPhase = false;
      this.debug('Control OUT status phase (ZLP)');
    } else if (epNum === 0 && this.pendingSetupResponse) {
      // Control IN - return pending setup response
      result = { status: 'ack', data: this.pendingSetupResponse };

      // Get requested length from buffer control
      const bufCtrl = this.rp2040.usbDPRAMView.getUint32(HOST_EPX_BUF_CTRL, true);
      const maxLen = bufCtrl & USB_BUF_CTRL_LEN_MASK;

      // Trim data to requested length
      if (result.data && result.data.length > maxLen) {
        result.data = result.data.slice(0, maxLen);
      }

      // Clear pending response if all data sent
      if (!result.data || result.data.length <= maxLen) {
        this.pendingSetupResponse = null;
      }
    } else {
      result = this.connectedDevice!.handleDataIn(epAddr);
    }

    if (result.status === 'ack' && result.data) {
      // Write data to EPX data buffer
      this.rp2040.usbDPRAM.set(result.data, HOST_EPX_DATA);

      // Update buffer control with actual length and FULL flag
      let bufCtrl = this.rp2040.usbDPRAMView.getUint32(HOST_EPX_BUF_CTRL, true);
      bufCtrl &= ~USB_BUF_CTRL_LEN_MASK;
      bufCtrl |= result.data.length & USB_BUF_CTRL_LEN_MASK;
      bufCtrl |= USB_BUF_CTRL_FULL;
      bufCtrl &= ~USB_BUF_CTRL_AVAILABLE;

      // Set DATA1 PID for control transfers
      if (this.controlDataPid) {
        bufCtrl |= USB_BUF_CTRL_DATA1_PID;
      } else {
        bufCtrl &= ~USB_BUF_CTRL_DATA1_PID;
      }
      this.controlDataPid ^= 1;

      this.rp2040.usbDPRAMView.setUint32(HOST_EPX_BUF_CTRL, bufCtrl, true);

      // Set buffer status
      this.buffStatus |= 1; // Bit 0 for EPX
      this.buffStatusUpdated();

      this.sieStatus |= SIE_ACK_REC;
    } else if (result.status === 'nak') {
      this.sieStatus |= SIE_NAK_REC;
    } else if (result.status === 'stall') {
      this.sieStatus |= SIE_STALL_REC;
    }

    this.hostTransactionAlarm.schedule(this.hostTransactionDelayMicroseconds * 1000);
  }

  private handleOutTransaction(devAddr: number, epNum: number): void {
    const epAddr = epNum; // OUT endpoint

    // Read data from EPX data buffer
    const bufCtrl = this.rp2040.usbDPRAMView.getUint32(HOST_EPX_BUF_CTRL, true);
    const dataLen = bufCtrl & USB_BUF_CTRL_LEN_MASK;
    const data = this.rp2040.usbDPRAM.slice(HOST_EPX_DATA, HOST_EPX_DATA + dataLen);

    let result: USBTransferResult;
    if (epNum === 0 && dataLen === 0) {
      // Zero-length status phase for control transfer
      result = { status: 'ack' };
    } else {
      result = this.connectedDevice!.handleDataOut(epAddr, data);
    }

    // Update buffer control
    let newBufCtrl = bufCtrl;
    newBufCtrl &= ~USB_BUF_CTRL_AVAILABLE;

    // Toggle DATA PID
    if (this.controlDataPid) {
      newBufCtrl |= USB_BUF_CTRL_DATA1_PID;
    } else {
      newBufCtrl &= ~USB_BUF_CTRL_DATA1_PID;
    }
    this.controlDataPid ^= 1;

    this.rp2040.usbDPRAMView.setUint32(HOST_EPX_BUF_CTRL, newBufCtrl, true);

    if (result.status === 'ack') {
      this.sieStatus |= SIE_ACK_REC;
      this.buffStatus |= 1; // Bit 0 for EPX
      this.buffStatusUpdated();
    } else if (result.status === 'nak') {
      this.sieStatus |= SIE_NAK_REC;
    } else if (result.status === 'stall') {
      this.sieStatus |= SIE_STALL_REC;
    }

    this.hostTransactionAlarm.schedule(this.hostTransactionDelayMicroseconds * 1000);
  }

  private completeHostTransaction(): void {
    // Clear START_TRANS bit
    this.sieCtrl &= ~SIE_CTRL_START_TRANS;

    // Set transaction complete
    this.sieStatus |= SIE_TRANS_COMPLETE;
    this.sieStatusUpdated();

    this.debug('Host transaction complete');
  }
}
