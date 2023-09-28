import { describe, expect, it } from 'vitest';
import { formatTime } from './time';

describe('formatTime', () => {
  it('should correctly format a timestamp with microseconds, padding with spaces', () => {
    expect(formatTime(new Date(2020, 10, 10, 4, 55, 2, 12))).toBe('04:55:02.12 ');
  });
});
