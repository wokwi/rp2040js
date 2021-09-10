import { RPUSBController } from '../peripherals/usb';
import { FIFO } from '../utils/fifo';
import { DataDirection, DescriptorType, SetupRecipient, SetupType } from './interfaces';
import {
  createSetupPacket,
  getDescriptorPacket,
  setDeviceAddressPacket,
  setDeviceConfigurationPacket,
} from './setup';

// CDC stuff
const CDC_REQUEST_SET_CONTROL_LINE_STATE = 0x22;

const CDC_DTR = 1 << 0;
const CDC_RTS = 1 << 1;

const CDC_DATA_CLASS = 10;
const ENDPOINT_BULK = 2;

const TX_FIFO_SIZE = 512;

const ENDPOINT_ZERO = 0;
const CONFIGURATION_DESCRIPTOR_SIZE = 9;

export function extractEndpointNumbers(descriptors: ArrayLike<number>) {
  let index = 0;
  let foundInterface = false;
  const result = {
    in: -1,
    out: -1,
  };
  while (index < descriptors.length) {
    const len = descriptors[index];
    if (len < 2 || descriptors.length < index + len) {
      break;
    }
    const type = descriptors[index + 1];
    if (type === DescriptorType.Interface && len === 9) {
      const numEndpoints = descriptors[index + 4];
      const interfaceClass = descriptors[index + 5];
      foundInterface = numEndpoints === 2 && interfaceClass === CDC_DATA_CLASS;
    }
    if (foundInterface && type === DescriptorType.Endpoint && len === 7) {
      const address = descriptors[index + 2];
      const attributes = descriptors[index + 3];
      if ((attributes & 0x3) === ENDPOINT_BULK) {
        if (address & 0x80) {
          result.in = address & 0xf;
        } else {
          result.out = address & 0xf;
        }
      }
    }
    index += descriptors[index];
  }
  return result;
}

export class USBCDC {
  readonly txFIFO = new FIFO(TX_FIFO_SIZE);

  onSerialData?: (buffer: Uint8Array) => void;
  onDeviceConnected?: () => void;

  private initialized = false;
  private descriptorsSize: number | null = null;
  private descriptors: number[] = [];
  private outEndpoint = -1;
  private inEndpoint = -1;

  constructor(readonly usb: RPUSBController) {
    this.usb.onUSBEnabled = () => {
      this.usb.resetDevice();
    };
    this.usb.onResetReceived = () => {
      this.usb.sendSetupPacket(setDeviceAddressPacket(1));
    };
    this.usb.onEndpointWrite = (endpoint, buffer) => {
      if (endpoint === ENDPOINT_ZERO && buffer.length === 0) {
        if (this.descriptorsSize == null) {
          this.usb.sendSetupPacket(
            getDescriptorPacket(DescriptorType.Configration, CONFIGURATION_DESCRIPTOR_SIZE)
          );
        }
        // Acknowledgement
        else if (!this.initialized) {
          this.cdcSetControlLineState();
          this.onDeviceConnected?.();
        }
      }
      if (endpoint === ENDPOINT_ZERO && buffer.length > 1) {
        if (
          buffer.length === CONFIGURATION_DESCRIPTOR_SIZE &&
          buffer[1] === DescriptorType.Configration &&
          this.descriptorsSize == null
        ) {
          this.descriptorsSize = (buffer[3] << 8) | buffer[2];
          this.usb.sendSetupPacket(
            getDescriptorPacket(DescriptorType.Configration, this.descriptorsSize)
          );
        } else if (this.descriptorsSize != null && this.descriptors.length < this.descriptorsSize) {
          this.descriptors.push(...buffer);
        }
        if (this.descriptorsSize === this.descriptors.length) {
          const endpoints = extractEndpointNumbers(this.descriptors);
          this.inEndpoint = endpoints.in;
          this.outEndpoint = endpoints.out;

          // Now configure the device
          this.usb.sendSetupPacket(setDeviceConfigurationPacket(1));
        }
      }
      if (endpoint === this.inEndpoint) {
        this.onSerialData?.(buffer);
      }
    };
    this.usb.onEndpointRead = (endpoint, size) => {
      if (endpoint === this.outEndpoint) {
        const buffer = new Uint8Array(Math.min(size, this.txFIFO.itemCount));
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = this.txFIFO.pull();
        }
        this.usb.endpointReadDone(this.outEndpoint, buffer);
      }
    };
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
  }
}
