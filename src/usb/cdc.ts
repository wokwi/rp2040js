import { RPUSBController } from '../peripherals/usb';
import { FIFO } from '../utils/fifo';
import { DataDirection, SetupRecipient, SetupType } from './interfaces';
import { createSetupPacket, setDeviceAddressPacket, setDeviceConfigurationPacket } from './setup';

// CDC stuff
const CDC_REQUEST_SET_CONTROL_LINE_STATE = 0x22;

const CDC_DTR = 1 << 0;
const CDC_RTS = 1 << 1;

const CDC_ENDPOINT = 2;

const TX_FIFO_SIZE = 512;

export class USBCDC {
  readonly txFIFO = new FIFO(TX_FIFO_SIZE);

  onSerialData?: (buffer: Uint8Array) => void;
  onDeviceConnected?: () => void;

  private initialized = false;
  private deviceConfigured = false;
  private deviceWaitingForData = false;
  private outBufferSize = 0;

  constructor(readonly usb: RPUSBController) {
    this.usb.onUSBEnabled = () => {
      this.usb.resetDevice();
    };
    this.usb.onResetReceived = () => {
      this.usb.sendSetupPacket(setDeviceAddressPacket(1));
    };
    this.usb.onEndpointWrite = (endpoint, buffer) => {
      if (endpoint === 0 && buffer.length === 0) {
        // Acknowledgement
        if (!this.deviceConfigured) {
          this.usb.sendSetupPacket(setDeviceConfigurationPacket(1));
          this.deviceConfigured = true;
        } else if (!this.initialized) {
          this.cdcSetControlLineState();
          this.onDeviceConnected?.();
        }
      }
      if (endpoint === CDC_ENDPOINT) {
        this.onSerialData?.(buffer);
      }
    };
    this.usb.onEndpointRead = (endpoint, size) => {
      if (endpoint === CDC_ENDPOINT) {
        this.deviceWaitingForData = true;
        this.outBufferSize = size;
        if (!this.txFIFO.empty) {
          this.sendDataToDevice();
        }
      }
    };
  }

  protected sendDataToDevice() {
    if (!this.deviceWaitingForData) {
      return;
    }

    const buffer = new Uint8Array(Math.min(this.outBufferSize, this.txFIFO.itemCount));
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = this.txFIFO.pull();
    }
    this.usb.endpointReadDone(CDC_ENDPOINT, buffer);
    this.deviceWaitingForData = false;
  }

  private cdcSetControlLineState(value = CDC_DTR | CDC_RTS, interfaceNumber = 0) {
    this.usb.sendSetupPacket(
      createSetupPacket({
        dataDirection: DataDirection.HostToDevice,
        type: SetupType.Class,
        recipient: SetupRecipient.Device,
        bRequest: CDC_REQUEST_SET_CONTROL_LINE_STATE,
        wValue: value,
        wIndex: interfaceNumber,
        wLength: 0,
      })
    );
    this.initialized = true;
  }

  sendSerialByte(data: number) {
    this.txFIFO.push(data);
    this.sendDataToDevice();
  }
}
