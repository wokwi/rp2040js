#include <stdio.h>
#include "pico/stdlib.h"
#include "hardware/structs/rosc.h"
#include "dual-mcu.pio.h"

int main() {
  stdio_init_all();

  uint bus_start_pin = 2; // start at GPIO2, leave GPIO0/1 to UART
  PIO pio = pio0;
  uint sm = pio_claim_unused_sm(pio, true);
  uint offset = pio_add_program(pio, &dualmcu_program);
  dualmcu_program_init(pio, sm, offset, bus_start_pin, 500); // run PIO at 125MHz/500=0.25MHz

#ifdef MCU0
  uint mcu = 0;
#else
  uint mcu = 1;
#endif
  uint8_t bus_cycle = 0;
  while (true) {
    // The PIO program keeps pins at low and changes pindirs instead:
    // pindir 1 (output) thus pulls the pin to low,
    // pindir 0 (input) will make the pullup pull the signal to high
    // (unless the other MCU drives that pin low).
    uint32_t bus_val = (1 << ((mcu == 0) ? bus_cycle : (8 - bus_cycle))) ^ 0xff;
    uint32_t out_dirs = bus_val ^ 0xff;
    pio_sm_put_blocking(pio, sm, out_dirs);
    uint32_t read_val = pio_sm_get_blocking(pio, sm);

    if(mcu == 0) {
      sleep_us(10); // just make sure the emulator does not print messages on top of each other
    }
    printf("mcu%d - value put: %02lx - value read: %02lx\n", mcu, bus_val, read_val);
    bus_cycle = (bus_cycle + 1) % 8;
  }
}
