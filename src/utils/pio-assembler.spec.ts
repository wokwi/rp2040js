import {
  opcodePIOJMP,
  opcodePIOWAIT,
  opcodePIOIN,
  opcodePIOOUT,
  opcodePIOPUSH,
  opcodePIOPULL,
  opcodePIOMOV,
  opcodePIOIRQ,
  opcodePIOSET,
} from './pio-assembler';

const PIO_SRC_PINS = 0;
const PIO_SRC_X = 1;
const PIO_SRC_Y = 2;
const PIO_SRC_NULL = 3;
const PIO_SRC_STATUS = 5;
const PIO_SRC_ISR = 6;
const PIO_SRC_OSR = 7;

const PIO_DEST_PINS = 0;
const PIO_DEST_X = 1;
const PIO_DEST_Y = 2;
const PIO_DEST_NULL = 3;
const PIO_DEST_PINDIRS = 4;
const PIO_DEST_PC = 5;
const PIO_DEST_ISR = 6;
const PIO_DEST_EXEC = 7;

const PIO_MOV_DEST_PINS = 0;
const PIO_MOV_DEST_X = 1;
const PIO_MOV_DEST_Y = 2;
const PIO_MOV_DEST_EXEC = 4;
const PIO_MOV_DEST_PC = 5;
const PIO_MOV_DEST_ISR = 6;
const PIO_MOV_DEST_OSR = 7;

const PIO_OP_NONE = 0;
const PIO_OP_INVERT = 1;
const PIO_OP_BITREV = 2;

const PIO_WAIT_SRC_GPIO = 0;
const PIO_WAIT_SRC_PIN = 1;
const PIO_WAIT_SRC_IRQ = 2;

const PIO_COND_ALWAYS = 0;
const PIO_COND_NOTX = 1;
const PIO_COND_NOTXDEC = 2;
const PIO_COND_NOTY = 3;
const PIO_COND_NOTYDEC = 4;
const PIO_COND_XNEY = 5;
const PIO_COND_PIN = 6;
const PIO_COND_NOTEMPTYOSR = 7;

describe('pio-assembler', () => {
  it('should correctly encode an `jmp PIN, 5` pio instruction', () => {
    expect(opcodePIOJMP(PIO_COND_PIN, 5)).toEqual(0xc5);
  });

  it('should correctly encode an `wait 1 gpio 12` pio instruction', () => {
    expect(opcodePIOWAIT(1, PIO_WAIT_SRC_GPIO, 12)).toEqual(0x208c);
  });

  it('should correctly encode an `in X, 12` pio instruction', () => {
    expect(opcodePIOIN(PIO_SRC_X, 12)).toEqual(0x402c);
  });

  it('should correctly encode an `out Y, 30` pio instruction', () => {
    expect(opcodePIOOUT(PIO_DEST_Y, 30)).toEqual(0x605e);
  });

  it('should correctly encode an `push iffull noblock` pio instruction', () => {
    expect(opcodePIOPUSH(1, 1, 12)).toEqual(0x8c60);
  });

  it('should correctly encode an `pull block` pio instruction', () => {
    expect(opcodePIOPULL(1, 0)).toEqual(0x80c0);
  });

  it('should correctly encode an `mov X, !STATUS` pio instruction', () => {
    expect(opcodePIOMOV(PIO_MOV_DEST_X, PIO_OP_INVERT, PIO_SRC_STATUS)).toEqual(0xa029);
  });

  it('should correctly encode an `irq set 4` pio instruction', () => {
    expect(opcodePIOIRQ(0, 0, 4)).toEqual(0xc004);
  });

  it('should correctly encode an `set X, 12` pio instruction', () => {
    expect(opcodePIOSET(PIO_MOV_DEST_X, 12)).toEqual(0xe02c);
  });
});
