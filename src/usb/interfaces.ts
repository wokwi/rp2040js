export enum DataDirection {
  HostToDevice,
  DeviceToHost,
}

export enum SetupType {
  Standard,
  Class,
  Vendor,
  Reserved,
}

export enum SetupRecipient {
  Device,
  Interface,
  Endpoint,
  Other,
}

export enum SetupRequest {
  GetStatus,
  ClearFeature,
  Reserved1,
  SetFeature,
  Reserved2,
  SetAddress,
  GetDescriptor,
  SetDescriptor,
  GetConfiguration,
  SetDeviceConfiguration,
  GetInterface,
  SetInterface,
  SynchFrame,
}

export enum DescriptorType {
  Device = 1,
  Configration = 2,
  String = 3,
  Interface = 4,
  Endpoint = 5,
}

export interface ISetupPacketParams {
  dataDirection: DataDirection;
  type: SetupType;
  recipient: SetupRecipient;
  bRequest: SetupRequest;
  wValue: number /* 16 bits */;
  wIndex: number /* 16 bits */;
  wLength: number /* 16 bits */;
}
