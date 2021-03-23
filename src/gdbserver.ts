/**
 * RP2040 GDB Server
 *
 * Copyright (C) 2021, Uri Shaked
 */

import { createServer } from 'net';
import { RP2040 } from './rp2040';
import * as fs from 'fs';

const GDB_PORT = 3333;
const DEBUG = true;

const STOP_REPLY_TRAP = 'S05';

function encodeHexByte(value: number) {
  return (value >> 4).toString(16) + (value & 0xf).toString(16);
}

function encodeHexBuf(buf: Uint8Array) {
  return Array.from(buf).map(encodeHexByte).join('');
}

function decodeHexBuf(encoded: string) {
  const result = new Uint8Array(encoded.length / 2);
  for (let i = 0; i < result.length; i++) {
    result[i] = parseInt(encoded.substr(i * 2, 2), 16);
  }
  return result;
}

function gdbChecksum(text: string) {
  const value =
    text
      .split('')
      .map((c) => c.charCodeAt(0))
      .reduce((a, b) => a + b, 0) & 0xff;
  return encodeHexByte(value);
}

function gdbResponse(value: string) {
  return `$${value}#${gdbChecksum(value)}`;
}

const hex = fs.readFileSync('src/hello_uart.hex', 'utf-8');
const rp2040 = new RP2040(hex);
rp2040.PC = 0x10000001;

function processGDBMessage(cmd: string) {
  if (cmd === 'Hg0') {
    return gdbResponse('OK');
  }

  switch (cmd[0]) {
    case '?':
      return gdbResponse(STOP_REPLY_TRAP);

    case 'q':
      // Query things
      if (cmd.startsWith('qSupported:')) {
        return gdbResponse('PacketSize=4000;vContSupported+');
      }
      if (cmd === 'qAttached') {
        return gdbResponse('1');
      }
      return gdbResponse('');

    case 'v':
      if (cmd === 'vCont?') {
        return gdbResponse('vCont;c;C;s;S');
      }
      if (cmd.startsWith('vCont;c')) {
        rp2040.execute();
      }
      if (cmd.startsWith('vCont;s')) {
        rp2040.executeInstruction();
        return gdbResponse(STOP_REPLY_TRAP);
      }
      break;

    case 'c':
      rp2040.execute();
      break;

    case 'g': {
      // Read registers
      const buf = new Uint32Array(17);
      buf[16] = 0; // TODO XPSR, which is APSR+EPSR+IPSR - Figure B1-1 in the Armv6-m manual ;)
      buf.set(rp2040.registers);
      return gdbResponse(encodeHexBuf(new Uint8Array(buf.buffer)));
    }

    case 'm': {
      // Read memory
      const params = cmd.substr(1).split(',');
      const address = parseInt(params[0], 16);
      const length = parseInt(params[1], 16);
      console.log('Reading from', address, 'count', length);
      let result = '';
      for (let i = 0; i < length; i++) {
        result += encodeHexByte(rp2040.readUint8(address + i));
      }
      return gdbResponse(result);
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
      return gdbResponse('OK');
    }
  }

  return gdbResponse('');
}

const gdbserver = createServer();
gdbserver.listen(GDB_PORT);

console.log(`RP2040 GDB Server ready! Listening on port ${GDB_PORT}`);

gdbserver.on('connection', (socket) => {
  console.log('GDB connected\n');

  rp2040.onBreak = () => {
    rp2040.stop();
    rp2040.PC -= 2;
    socket.write(gdbResponse(STOP_REPLY_TRAP));
  };

  let buf = '';
  socket.on('data', (data) => {
    if (data[0] === 3) {
      console.log('BREAK');
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
        const response = processGDBMessage(cmd);
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
});
