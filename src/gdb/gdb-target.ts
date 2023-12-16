import { RP2040 } from '../rp2040.js';

export interface IGDBTarget {
  readonly executing: boolean;
  rp2040: RP2040;

  execute(): void;
  stop(): void;
}
