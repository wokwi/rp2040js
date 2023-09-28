import {
  DataDirection,
  DescriptorType,
  ISetupPacketParams,
  SetupRecipient,
  SetupRequest,
  SetupType,
} from './interfaces.js';

export function createSetupPacket(params: ISetupPacketParams) {
  const setupPacket = new Uint8Array(8);
  setupPacket[0] = (params.dataDirection << 7) | (params.type << 5) | params.recipient;
  setupPacket[1] = params.bRequest;
  setupPacket[2] = params.wValue & 0xff;
  setupPacket[3] = (params.wValue >> 8) & 0xff;
  setupPacket[4] = params.wIndex & 0xff;
  setupPacket[5] = (params.wIndex >> 8) & 0xff;
  setupPacket[6] = params.wLength & 0xff;
  setupPacket[7] = (params.wLength >> 8) & 0xff;
  return setupPacket;
}

export function setDeviceAddressPacket(address: number) {
  return createSetupPacket({
    dataDirection: DataDirection.HostToDevice,
    type: SetupType.Standard,
    recipient: SetupRecipient.Device,
    bRequest: SetupRequest.SetAddress,
    wValue: address,
    wIndex: 0,
    wLength: 0,
  });
}

export function getDescriptorPacket(type: DescriptorType, length: number, index = 0) {
  return createSetupPacket({
    dataDirection: DataDirection.DeviceToHost,
    type: SetupType.Standard,
    recipient: SetupRecipient.Device,
    bRequest: SetupRequest.GetDescriptor,
    wValue: type << 8,
    wIndex: index,
    wLength: length,
  });
}

export function setDeviceConfigurationPacket(configurationNumber: number) {
  return createSetupPacket({
    dataDirection: DataDirection.HostToDevice,
    type: SetupType.Standard,
    recipient: SetupRecipient.Device,
    bRequest: SetupRequest.SetDeviceConfiguration,
    wValue: configurationNumber,
    wIndex: 0,
    wLength: 0,
  });
}
