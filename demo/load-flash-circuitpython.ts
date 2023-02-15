import { closeSync, openSync, readSync } from 'fs';
import { decodeBlock } from 'uf2';
import { RP2040 } from '../src';
import { FLASH_START_ADDRESS } from '../src/rp2040';

const CIRCUITPYTHON_FS_FLASH_START = 0x100000;
const CIRCUITPYTHON_FS_BLOCKSIZE = 4096;
const CIRCUITPYTHON_FS_BLOCKCOUNT = 512;

export function loadCircuitpythonFlashImage(filename: string, rp2040: RP2040) {
  const file = openSync(filename, 'r');
  const buffer = new Uint8Array(CIRCUITPYTHON_FS_BLOCKSIZE);
  let flashAddress = CIRCUITPYTHON_FS_FLASH_START;
  while (readSync(file, buffer) === buffer.length) {
    rp2040.flash.set(buffer, flashAddress);
    flashAddress += buffer.length;
  }
  closeSync(file);
}

export function loadUF2(filename: string, rp2040: RP2040) {
  const file = openSync(filename, 'r');
  const buffer = new Uint8Array(512);
  while (readSync(file, buffer) === buffer.length) {
    const block = decodeBlock(buffer);
    const { flashAddress, payload } = block;
    rp2040.flash.set(payload, flashAddress - FLASH_START_ADDRESS);
  }
  closeSync(file);
}
