export class FIFO {
  readonly buffer: Uint32Array;

  private start = 0;
  private used = 0;
  private capacity: number;

  constructor(size: number) {
    this.buffer = new Uint32Array(size);
    this.capacity = size;
  }

  get size() {
    return this.capacity;
  }

  /**
   * Change the usable depth of the FIFO, up to the size it was allocated with.
   * Used by the PIO peripheral to implement FJOIN_TX / FJOIN_RX, where the two
   * 4-deep FIFOs can be merged into a single 8-deep one. Reconfiguring the depth
   * empties the FIFO, matching the RP2040 hardware behaviour.
   */
  setCapacity(capacity: number) {
    this.capacity = Math.min(Math.max(capacity, 0), this.buffer.length);
    this.start = 0;
    this.used = 0;
  }

  get itemCount() {
    return this.used;
  }

  push(value: number) {
    const { length } = this.buffer;
    const { start, used } = this;
    if (this.used < this.capacity) {
      this.buffer[(start + used) % length] = value;
      this.used++;
    }
  }

  pull() {
    const { start, used } = this;
    const { length } = this.buffer;
    if (used) {
      this.start = (start + 1) % length;
      this.used--;
      return this.buffer[start];
    }
    return 0;
  }

  peek() {
    return this.used ? this.buffer[this.start] : 0;
  }

  reset() {
    this.used = 0;
  }

  get empty() {
    return this.used == 0;
  }

  get full() {
    return this.used >= this.capacity;
  }

  get items() {
    const { start, used, buffer } = this;
    const { length } = buffer;
    const result = [];
    for (let i = 0; i < used; i++) {
      result[i] = buffer[(start + i) % length];
    }
    return result;
  }
}
