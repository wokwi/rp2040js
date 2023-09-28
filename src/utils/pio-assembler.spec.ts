import { it, describe, expect } from 'vitest';

import {
  pioJMP,
  pioWAIT,
  pioIN,
  pioOUT,
  pioPUSH,
  pioPULL,
  pioMOV,
  pioIRQ,
  pioSET,
  PIO_COND_PIN,
  PIO_WAIT_SRC_GPIO,
  PIO_SRC_X,
  PIO_DEST_Y,
  PIO_MOV_DEST_X,
  PIO_OP_INVERT,
  PIO_SRC_STATUS,
} from './pio-assembler';

describe('pio-assembler', () => {
  it('should correctly encode an `jmp PIN, 5` pio instruction', () => {
    expect(pioJMP(PIO_COND_PIN, 5)).toEqual(0xc5);
  });

  it('should correctly encode an `wait 1 gpio 12` pio instruction', () => {
    expect(pioWAIT(true, PIO_WAIT_SRC_GPIO, 12)).toEqual(0x208c);
  });

  it('should correctly encode an `in X, 12` pio instruction', () => {
    expect(pioIN(PIO_SRC_X, 12)).toEqual(0x402c);
  });

  it('should correctly encode an `out Y, 30` pio instruction', () => {
    expect(pioOUT(PIO_DEST_Y, 30)).toEqual(0x605e);
  });

  it('should correctly encode an `push iffull noblock` pio instruction', () => {
    expect(pioPUSH(true, true, 12)).toEqual(0x8c60);
  });

  it('should correctly encode an `pull block` pio instruction', () => {
    expect(pioPULL(true, false)).toEqual(0x80c0);
  });

  it('should correctly encode an `mov X, !STATUS` pio instruction', () => {
    expect(pioMOV(PIO_MOV_DEST_X, PIO_OP_INVERT, PIO_SRC_STATUS)).toEqual(0xa02d);
  });

  it('should correctly encode an `irq set 4` pio instruction', () => {
    expect(pioIRQ(false, false, 4)).toEqual(0xc004);
  });

  it('should correctly encode an `set X, 12` pio instruction', () => {
    expect(pioSET(PIO_MOV_DEST_X, 12)).toEqual(0xe02c);
  });
});
