/**
 * Interface for simulated USB devices that can be connected to the RP2040 USB host controller.
 */

export type USBTransferStatus = 'ack' | 'nak' | 'stall';

export interface USBTransferResult {
  status: USBTransferStatus;
  data?: Uint8Array;
}

export interface USBEndpointTransfer {
  endpointAddress: number;
  data: Uint8Array;
}

/**
 * Abstract interface for a USB device that can be connected to the RP2040 USB host.
 */
export interface USBDevice {
  /** Current device address (0 = default, 1-127 = assigned) */
  address: number;

  /**
   * Handle a SETUP packet from the host.
   * @param setup 8-byte setup packet
   * @returns Response data for control IN transfers, or status for control OUT
   */
  handleSetupPacket(setup: Uint8Array): USBTransferResult;

  /**
   * Handle data OUT from host to device (non-control endpoint).
   * @param endpointAddress Endpoint address (0x01-0x0F for OUT endpoints)
   * @param data Data received from host
   */
  handleDataOut(endpointAddress: number, data: Uint8Array): USBTransferResult;

  /**
   * Handle data IN request from host (non-control endpoint).
   * @param endpointAddress Endpoint address (0x81-0x8F for IN endpoints)
   * @returns Data to send to host, or NAK if no data available
   */
  handleDataIn(endpointAddress: number): USBTransferResult;

  /**
   * Called when the host resets the USB bus.
   */
  onReset(): void;

  /**
   * Called when the host assigns a new address to the device.
   */
  onAddressAssigned?(address: number): void;

  /**
   * Called when the host sets the device configuration.
   */
  onConfigured?(configurationValue: number): void;
}

// USB Setup packet fields - bmRequestType bit masks
// Direction (bit 7)
export const USB_DIR_OUT = 0x00;
export const USB_DIR_IN = 0x80;
// Type (bits 6:5)
export const USB_TYPE_STANDARD = 0x00;
export const USB_TYPE_CLASS = 0x20;
export const USB_TYPE_VENDOR = 0x40;
// Recipient (bits 4:0)
export const USB_RECIP_DEVICE = 0x00;
export const USB_RECIP_INTERFACE = 0x01;
export const USB_RECIP_ENDPOINT = 0x02;
export const USB_RECIP_OTHER = 0x03;

export const enum StandardRequest {
  GetStatus = 0,
  ClearFeature = 1,
  SetFeature = 3,
  SetAddress = 5,
  GetDescriptor = 6,
  SetDescriptor = 7,
  GetConfiguration = 8,
  SetConfiguration = 9,
  GetInterface = 10,
  SetInterface = 11,
  SynchFrame = 12,
}

export const enum DescriptorType {
  Device = 1,
  Configuration = 2,
  String = 3,
  Interface = 4,
  Endpoint = 5,
  DeviceQualifier = 6,
  OtherSpeedConfiguration = 7,
  InterfacePower = 8,
  HID = 0x21,
  HIDReport = 0x22,
  HIDPhysical = 0x23,
}

export function parseSetupPacket(setup: Uint8Array) {
  return {
    bmRequestType: setup[0],
    bRequest: setup[1],
    wValue: setup[2] | (setup[3] << 8),
    wIndex: setup[4] | (setup[5] << 8),
    wLength: setup[6] | (setup[7] << 8),
    // Helpers
    direction: setup[0] & 0x80 ? 'in' : 'out',
    type: (setup[0] >> 5) & 0x03, // 0=Standard, 1=Class, 2=Vendor
    recipient: setup[0] & 0x1f, // 0=Device, 1=Interface, 2=Endpoint, 3=Other
  } as const;
}
