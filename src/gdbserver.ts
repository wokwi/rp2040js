/**
 * RP2040 GDB Server
 *
 * Copyright (C) 2021, Uri Shaked
 */

import { createServer, Socket } from 'net';
import { RP2040, SYSM_CONTROL, SYSM_MSP, SYSM_PRIMASK, SYSM_PSP } from './rp2040';
import {
  decodeHexBuf,
  encodeHexBuf,
  encodeHexByte,
  encodeHexUint32,
  gdbChecksum,
  gdbMessage,
} from './utils/gdb';

const DEBUG = false;

const STOP_REPLY_SIGINT = 'S02';
const STOP_REPLY_TRAP = 'S05';

const targetXML = `<?xml version="1.0"?>
<!DOCTYPE target SYSTEM "gdb-target.dtd">
<target version="1.0">
<architecture>arm</architecture>
<feature name="org.gnu.gdb.arm.m-profile">
<reg name="r0" bitsize="32" regnum="0" save-restore="yes" type="int" group="general"/>
<reg name="r1" bitsize="32" regnum="1" save-restore="yes" type="int" group="general"/>
<reg name="r2" bitsize="32" regnum="2" save-restore="yes" type="int" group="general"/>
<reg name="r3" bitsize="32" regnum="3" save-restore="yes" type="int" group="general"/>
<reg name="r4" bitsize="32" regnum="4" save-restore="yes" type="int" group="general"/>
<reg name="r5" bitsize="32" regnum="5" save-restore="yes" type="int" group="general"/>
<reg name="r6" bitsize="32" regnum="6" save-restore="yes" type="int" group="general"/>
<reg name="r7" bitsize="32" regnum="7" save-restore="yes" type="int" group="general"/>
<reg name="r8" bitsize="32" regnum="8" save-restore="yes" type="int" group="general"/>
<reg name="r9" bitsize="32" regnum="9" save-restore="yes" type="int" group="general"/>
<reg name="r10" bitsize="32" regnum="10" save-restore="yes" type="int" group="general"/>
<reg name="r11" bitsize="32" regnum="11" save-restore="yes" type="int" group="general"/>
<reg name="r12" bitsize="32" regnum="12" save-restore="yes" type="int" group="general"/>
<reg name="sp" bitsize="32" regnum="13" save-restore="yes" type="data_ptr" group="general"/>
<reg name="lr" bitsize="32" regnum="14" save-restore="yes" type="int" group="general"/>
<reg name="pc" bitsize="32" regnum="15" save-restore="yes" type="code_ptr" group="general"/>
<reg name="xPSR" bitsize="32" regnum="16" save-restore="yes" type="int" group="general"/>
</feature>
<feature name="org.gnu.gdb.arm.m-system">
<reg name="msp" bitsize="32" regnum="17" save-restore="yes" type="data_ptr" group="system"/>
<reg name="psp" bitsize="32" regnum="18" save-restore="yes" type="data_ptr" group="system"/>
<reg name="primask" bitsize="1" regnum="19" save-restore="yes" type="int8" group="system"/>
<reg name="basepri" bitsize="8" regnum="20" save-restore="yes" type="int8" group="system"/>
<reg name="faultmask" bitsize="1" regnum="21" save-restore="yes" type="int8" group="system"/>
<reg name="control" bitsize="2" regnum="22" save-restore="yes" type="int8" group="system"/>
</feature>
</target>`;

export class GDBTCPServer {
  private socketServer = createServer();

  constructor(readonly rp2040: RP2040, readonly port: number = 3333) {
    this.socketServer.listen(port);
    this.socketServer.on('connection', (socket) => this.handleConnection(socket));
  }

  processGDBMessage(cmd: string) {
    const { rp2040 } = this;
    if (cmd === 'Hg0') {
      return gdbMessage('OK');
    }

    switch (cmd[0]) {
      case '?':
        return gdbMessage(STOP_REPLY_TRAP);

      case 'q':
        // Query things
        if (cmd.startsWith('qSupported:')) {
          return gdbMessage('PacketSize=4000;vContSupported+;qXfer:features:read+');
        }
        if (cmd === 'qAttached') {
          return gdbMessage('1');
        }
        if (cmd.startsWith('qXfer:features:read:target.xml')) {
          return gdbMessage('l' + targetXML);
        }
        return gdbMessage('');

      case 'v':
        if (cmd === 'vCont?') {
          return gdbMessage('vCont;c;C;s;S');
        }
        if (cmd.startsWith('vCont;c')) {
          rp2040.execute();
          return;
        }
        if (cmd.startsWith('vCont;s')) {
          rp2040.executeInstruction();
          return gdbMessage(STOP_REPLY_TRAP);
        }
        break;

      case 'c':
        rp2040.execute();
        break;

      case 'g': {
        // Read registers
        const buf = new Uint32Array(17);
        buf.set(rp2040.registers);
        buf[16] = rp2040.xPSR;
        return gdbMessage(encodeHexBuf(new Uint8Array(buf.buffer)));
      }

      case 'p': {
        // Read register
        const registerIndex = parseInt(cmd.substr(1), 16);
        if (registerIndex >= 0 && registerIndex <= 15) {
          return gdbMessage(encodeHexUint32(rp2040.registers[registerIndex]));
        }
        const specialRegister = (sysm: number) =>
          gdbMessage(encodeHexUint32(rp2040.readSpecialRegister(sysm)));
        switch (registerIndex) {
          case 0x10:
            return gdbMessage(encodeHexUint32(rp2040.xPSR));
          case 0x11:
            return specialRegister(SYSM_MSP);
          case 0x12:
            return specialRegister(SYSM_PSP);
          case 0x13:
            return specialRegister(SYSM_PRIMASK);
          case 0x14:
            return gdbMessage(encodeHexUint32(0)); // TODO BASEPRI
          case 0x15:
            return gdbMessage(encodeHexUint32(0)); // TODO faultmask
          case 0x16:
            return specialRegister(SYSM_CONTROL);
        }
        break;
      }

      case 'P': {
        // Write register
        const params = cmd.substr(1).split('=');
        const registerIndex = parseInt(params[0], 16);
        const registerValue = params[1].trim();
        if (registerIndex < 0 || registerIndex > 0x16 || registerValue.length !== 8) {
          return gdbMessage('E00');
        }
        const valueBuffer = new Uint8Array(decodeHexBuf(registerValue)).buffer;
        const value = new DataView(valueBuffer).getUint32(0, true);
        switch (registerIndex) {
          case 0x10:
            rp2040.xPSR = value;
            break;
          case 0x11:
            rp2040.writeSpecialRegister(SYSM_MSP, value);
            break;
          case 0x12:
            rp2040.writeSpecialRegister(SYSM_PSP, value);
            break;
          case 0x13:
            rp2040.writeSpecialRegister(SYSM_PRIMASK, value);
            break;
          case 0x14:
            break; // TODO BASEPRI
          case 0x15:
            break; // TODO faultmask
          case 0x16:
            rp2040.writeSpecialRegister(SYSM_CONTROL, value);
            break;
          default:
            rp2040.registers[registerIndex] = value;
            break;
        }
        return gdbMessage('OK');
      }

      case 'm': {
        // Read memory
        const params = cmd.substr(1).split(',');
        const address = parseInt(params[0], 16);
        const length = parseInt(params[1], 16);
        let result = '';
        for (let i = 0; i < length; i++) {
          result += encodeHexByte(rp2040.readUint8(address + i));
        }
        return gdbMessage(result);
      }

      case 'M': {
        // Write memory
        const params = cmd.substr(1).split(/[,:]/);
        const address = parseInt(params[0], 16);
        const length = parseInt(params[1], 16);
        const data = decodeHexBuf(params[2].substr(0, length * 2));
        for (let i = 0; i < data.length; i++) {
          console.log('write', data[i].toString(16), 'to', (address + i).toString(16));
          rp2040.writeUint8(address + i, data[i]);
        }
        return gdbMessage('OK');
      }
    }

    return gdbMessage('');
  }

  handleConnection(socket: Socket) {
    console.log('GDB connected\n');
    socket.setNoDelay(true);
    const { rp2040 } = this;

    rp2040.onBreak = () => {
      rp2040.stop();
      rp2040.PC -= rp2040.breakRewind;
      socket.write(gdbMessage(STOP_REPLY_TRAP));
    };

    let buf = '';
    socket.on('data', (data) => {
      if (data[0] === 3) {
        console.log('BREAK');
        rp2040.stop();
        socket.write(gdbMessage(STOP_REPLY_SIGINT));
        data = data.slice(1);
      }

      buf += data.toString('utf-8');
      for (;;) {
        const dolla = buf.indexOf('$');
        const hash = buf.indexOf('#', dolla + 1);
        if (dolla < 0 || hash < 0 || hash + 2 > buf.length) {
          return;
        }
        const cmd = buf.substring(dolla + 1, hash);
        const cksum = buf.substr(hash + 1, 2);
        buf = buf.substr(hash + 2);
        if (gdbChecksum(cmd) !== cksum) {
          console.warn('Warning: GDB checksum error in message:', cmd);
          socket.write('-');
        } else {
          socket.write('+');
          if (DEBUG) {
            console.log('>', cmd);
          }
          const response = this.processGDBMessage(cmd);
          if (response) {
            if (DEBUG) {
              console.log('<', response);
            }
            socket.write(response);
          }
        }
      }
    });

    socket.on('error', (err) => {
      console.error('GDB socket error', err);
    });

    socket.on('close', () => {
      console.log('GDB disconnected');
    });
  }
}
