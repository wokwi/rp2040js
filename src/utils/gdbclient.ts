import { Socket } from 'net';
import {
  decodeHexBuf,
  decodeHexUint32,
  decodeHexUint32Array,
  encodeHexBuf,
  encodeHexByte,
  encodeHexUint32,
  encodeHexUint32BE,
  gdbMessage,
} from './gdb';

function dumpUint32(value: number) {
  let valueStr = value.toString(16);
  while (valueStr.length < 8) {
    valueStr = '0' + valueStr;
  }
  return valueStr;
}

export class GDBClient {
  private socket = new Socket();
  private rejectCurrentResponse?: (e: Error) => void;

  async connect(host: string, port: number = 3333) {
    return new Promise<void>((resolve, reject) => {
      this.rejectCurrentResponse = reject;
      this.socket.once('error', (error) => {
        this.rejectCurrentResponse?.(new Error(`Socket error: ${error}`));
      });
      this.socket.once('close', () => {
        this.rejectCurrentResponse?.(new Error(`Socket was closed`));
      });
      this.socket.once('data', (data) => {
        if (data.toString() === '+') {
          resolve();
        } else {
          reject(new Error(`Invalid data from gdbserver: ${data}`));
        }
      });
      this.socket.connect(port, host);
    });
  }

  private readResponse() {
    return new Promise<string>((resolve, reject) => {
      this.rejectCurrentResponse = reject;
      let gotAck = false;
      let data = '';

      const listener = (buffer: Buffer) => {
        data += buffer.toString();
        if (!gotAck) {
          if (data[0] === '+') {
            gotAck = true;
            data = data.substr(1);
          } else {
            this.socket.off('data', listener);
            reject(new Error(`No ack from gdbserver: ${data}`));
          }
        }
        if (data.length && data[0] !== '$') {
          this.socket.off('data', listener);
          reject(new Error(`Invalid response from gdbserver: ${data}`));
        }
        const hashIndex = data.indexOf('#');
        if (hashIndex >= 0 && hashIndex + 2 < data.length) {
          this.socket.off('data', listener);
          resolve(data.substring(1, hashIndex));
        }
      };
      this.socket.on('data', listener);
    });
  }

  private async sendCommand(command: string) {
    this.socket.write(gdbMessage(command));
    return await this.readResponse();
  }

  async readRegisters() {
    const response = await this.sendCommand('g');
    return decodeHexUint32Array(response);
  }

  async dumpRegisters() {
    const registerNames = [
      'r0',
      'r1',
      'r2',
      'r3',
      'r4',
      'r5',
      'r6',
      'r7',
      'r8',
      'r9',
      'r10',
      'r11',
      'r12',
      'sp',
      'lr',
      'pc',
      'xPSR',
    ];
    const registers = await this.readRegisters();
    for (let i = 0; i < registerNames.length; i++) {
      console.log(registerNames[i], '=', '0x' + dumpUint32(registers[i]));
    }
  }

  async readRegister(index: number) {
    const response = await this.sendCommand(`p${encodeHexByte(index)}`);
    return decodeHexUint32(response);
  }

  async writeRegister(index: number, value: number) {
    const response = await this.sendCommand(`P${encodeHexByte(index)}=${encodeHexUint32(value)}`);
    if (response !== 'OK') {
      throw new Error(`Invalid writeRegister response: ${response}`);
    }
  }

  async singleStep() {
    const response = await this.sendCommand('vCont;s:1;c');
    if (!response.startsWith('T')) {
      throw new Error(`Invalid singleStep response: ${response}`);
    }
  }

  async readMemory(address: number, length: number) {
    const addressStr = encodeHexUint32BE(address);
    const lengthStr = encodeHexUint32BE(length);
    const response = await this.sendCommand(`m ${addressStr},${lengthStr}`);
    return decodeHexBuf(response);
  }

  async writeMemory(address: number, data: Uint8Array) {
    const addressStr = encodeHexUint32BE(address);
    const lengthStr = encodeHexUint32BE(data.length);
    const response = await this.sendCommand(`M ${addressStr},${lengthStr}:${encodeHexBuf(data)}`);
    if (response !== 'OK') {
      throw new Error(`Invalid writeRegister response: ${response}`);
    }
  }
}
