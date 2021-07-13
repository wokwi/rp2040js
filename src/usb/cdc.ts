import { RPUSBController } from '../peripherals/usb';
import { DataDirection, SetupRecipient, SetupType } from './interfaces';
import { createSetupPacket, setDeviceAddressPacket, setDeviceConfigurationPacket } from './setup';

// CDC stuff
const CDC_REQUEST_SET_CONTROL_LINE_STATE = 0x22;

const CDC_DTR = 1 << 0;
const CDC_RTS = 1 << 1;

export class USBCDC {
  onSerialData?: (buffer: Uint8Array) => void;

  private initialized = false;
  private deviceConfigured = false;

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
        }
      }
      if (endpoint === 2) {
        this.onSerialData?.(buffer);
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
}
