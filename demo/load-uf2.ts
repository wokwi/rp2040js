import { closeSync, openSync, readSync } from 'fs';
import { decodeBlock } from 'uf2';
import { RP2040 } from '../src';

export function loadUF2(filename: string, rp2040: RP2040) {
  const file = openSync(filename, 'r');
  const buffer = new Uint8Array(512);
  while (readSync(file, buffer) === buffer.length) {
    const block = decodeBlock(buffer);
    const { flashAddress, payload } = block;
    rp2040.flash.set(payload, flashAddress - 0x10000000);
  }
  closeSync(file);
}
