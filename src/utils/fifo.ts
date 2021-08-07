export class FIFO {
  readonly buffer: Uint32Array;

  private start = 0;
  private used = 0;

  constructor(size: number) {
    this.buffer = new Uint32Array(size);
  }

  get size() {
    return this.buffer.length;
  }

  get itemCount() {
    return this.used;
  }

  push(value: number) {
    const { length } = this.buffer;
    const { start, used } = this;
    if (this.used < length) {
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
    return this.used === this.buffer.length;
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
