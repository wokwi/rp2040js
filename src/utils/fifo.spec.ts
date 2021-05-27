import { FIFO } from './fifo';

describe('FIFO', () => {
  it('should successfully push and pull 4 items', () => {
    const fifo = new FIFO(3);
    expect(fifo.empty).toBe(true);
    fifo.push(1);
    expect(fifo.empty).toBe(false);
    fifo.push(2);
    expect(fifo.itemCount).toBe(2);
    expect(fifo.full).toBe(false);
    fifo.push(3);
    expect(fifo.full).toBe(true);
    expect(fifo.pull()).toBe(1);
    expect(fifo.full).toBe(false);
    fifo.push(4);
    expect(fifo.full).toBe(true);
    expect(fifo.pull()).toBe(2);
    expect(fifo.pull()).toBe(3);
    expect(fifo.empty).toBe(false);
    expect(fifo.itemCount).toBe(1);
    expect(fifo.pull()).toBe(4);
    expect(fifo.full).toBe(false);
    expect(fifo.empty).toBe(true);
  });
});
