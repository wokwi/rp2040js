import { describe, expect, it } from 'vitest';
import { extractEndpointNumbers } from './cdc';

describe('extractEndpointNumbers', () => {
  it('should not die if the descriptors are invalid', () => {
    expect(extractEndpointNumbers([0])).toEqual({
      in: -1,
      out: -1,
    });

    expect(extractEndpointNumbers([9])).toEqual({
      in: -1,
      out: -1,
    });
  });

  it('should extract the endpoint numbers from Pi Pico SDK descriptors', () => {
    const sdkCDCDescriptors = [
      ...[9, 2, 84, 0, 3, 1, 0, 128, 125],
      ...[8, 11, 0, 2, 2, 2, 0, 0],
      ...[9, 4, 0, 0, 1, 2, 2, 0, 4],
      ...[5, 36, 0, 32, 1],
      ...[5, 36, 1, 0, 1],
      ...[4, 36, 2, 2],
      ...[5, 36, 6, 0, 1],
      ...[7, 5, 129, 3, 8, 0, 16],
      ...[9, 4, 1, 0, 2, 10, 0, 0, 0],
      ...[7, 5, 2, 2, 64, 0, 0],
      ...[7, 5, 130, 2, 64, 0, 0],
      ...[9, 4, 2, 0, 0, 255, 0, 1, 5],
    ];
    expect(extractEndpointNumbers(sdkCDCDescriptors)).toEqual({
      in: 2,
      out: 2,
    });
  });

  it('should extract the endpoint numbers from MicroPython descriptors', () => {
    const micropythonDescriptors = [
      ...[9, 2, 75, 0, 2, 1, 0, 128, 125], // Configuration descriptor
      ...[8, 11, 0, 2, 2, 2, 0, 0],
      ...[9, 4, 0, 0, 1, 2, 2, 0, 4], // Interface descriptor
      ...[5, 36, 0, 32, 1],
      ...[5, 36, 1, 0, 1],
      ...[4, 36, 2, 2],
      ...[5, 36, 6, 0, 1],
      ...[7, 5, 129, 3, 8, 0, 16], // Endpoint (interrupt)
      ...[9, 4, 1, 0, 2, 10, 0, 0, 0], // interface (CDC-Data class)
      ...[7, 5, 2, 2, 64, 0, 0], // Endpoint (bulk)
      ...[7, 5, 130, 2, 64, 0, 0], // Endpoint (bulk)
    ];
    expect(extractEndpointNumbers(micropythonDescriptors)).toEqual({
      in: 2,
      out: 2,
    });
  });

  it('should extract the endpoint numbers from CircuitPython descriptors', () => {
    const circuitPythonDescriptors = [
      ...[9, 2, 218, 0, 6, 1, 0, 128, 50],
      ...[8, 11, 0, 2, 2, 2, 0, 0],
      ...[9, 4, 0, 0, 1, 2, 2, 0, 4],
      ...[5, 36, 0, 16, 1],
      ...[5, 36, 1, 1, 1],
      ...[4, 36, 2, 2],
      ...[5, 36, 6, 0, 1],
      ...[7, 5, 129, 3, 64, 0, 16],
      ...[9, 4, 1, 0, 2, 10, 0, 0, 5],
      ...[7, 5, 2, 2, 64, 0, 0],
      ...[7, 5, 130, 2, 64, 0, 0],
      ...[9, 4, 2, 0, 2, 8, 6, 80, 6],
      ...[7, 5, 131, 2, 64, 0, 0],
      ...[7, 5, 3, 2, 64, 0, 0],
      ...[9, 4, 3, 0, 2, 3, 0, 0, 7],
      ...[9, 33, 17, 1, 0, 1, 34, 195, 0],
      ...[7, 5, 132, 3, 64, 0, 8],
      ...[7, 5, 4, 3, 64, 0, 8],
      ...[9, 4, 4, 0, 0, 1, 1, 0, 11],
      ...[9, 36, 1, 0, 1, 9, 0, 1, 5],
      ...[9, 4, 5, 0, 2, 1, 3, 0, 10],
      ...[7, 36, 1, 0, 1, 37, 0],
      ...[6, 36, 2, 1, 1, 8],
      ...[6, 36, 2, 2, 2, 0],
      ...[9, 36, 3, 1, 3, 1, 2, 1, 9],
      ...[9, 36, 3, 2, 4, 1, 1, 1, 0],
      ...[7, 5, 5, 2, 64, 0, 0],
      ...[5, 37, 1, 1, 1],
      ...[7, 5, 133, 2, 64, 0, 0],
      ...[5, 37, 1, 1, 3],
    ];
    expect(extractEndpointNumbers(circuitPythonDescriptors)).toEqual({
      in: 2,
      out: 2,
    });
  });

  it('should extract the endpoint numbers from Arduino Core descriptors', () => {
    const arduinoCoreDescriptors = [
      ...[9, 2, 75, 0, 2, 1, 0, 192, 250],
      ...[8, 11, 0, 2, 2, 2, 0, 0],
      ...[9, 4, 0, 0, 1, 2, 2, 1, 0], //     Interface
      ...[5, 36, 0, 16, 1],
      ...[5, 36, 1, 3, 1],
      ...[4, 36, 2, 6],
      ...[5, 36, 6, 0, 1],
      ...[7, 5, 130, 3, 64, 0, 16], // Endpoint
      ...[9, 4, 1, 0, 2, 10, 0, 0, 0], //  Interface
      ...[7, 5, 129, 2, 64, 0, 0], // Endpoint
      ...[7, 5, 1, 2, 64, 0, 0], // Endpoint
    ];
    expect(extractEndpointNumbers(arduinoCoreDescriptors)).toEqual({
      in: 1,
      out: 1,
    });
  });
});
