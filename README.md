# rp2040js

Raspberry Pi Pico Emulator for the [Wokwi Simulation Platform](https://wokwi.com). It blinks, runs Arduino code, and even the MicroPython REPL!

## Online examples

If you are just looking to play around with the Raspberry Pi Pico Simulator, check out the Wokwi Simulator:

* [Raspberry Pi Pico Traffic Light](https://wokwi.com/arduino/projects/297322571959894536)
* [LCD1602 Hello World](https://wokwi.com/arduino/projects/297323005822894602)
* [MicroPython Blink](https://wokwi.com/arduino/projects/300504213470839309)
* [MicroPython 7-Segment Counter](https://wokwi.com/arduino/projects/300210834979684872)

For more information, take a look at the [wokwi-pi-pico docs](https://docs.wokwi.com/parts/wokwi-pi-pico) and the [Pi Pico MicroPython Guide](https://docs.wokwi.com/guides/micropython).

If you want to develop your own application using the Raspberry Pi Pico simulator, the following examples may be helpful:

* [Blink LEDs with RP2040js, from scratch](https://stackblitz.com/edit/rp2040js-blink?file=index.ts) - Press "Run" and patiently wait for the code to compile ;-)

## Run the demo project

You'd need to get `hello_uart.hex` by building it from the [pico-examples repo](https://github.com/raspberrypi/pico-examples/tree/master/uart/hello_uart), then copy it to the rp2040js root directory and run:

```
npm install
npm start
```

To run the micropython demo, first download [rp2-pico-20210902-v1.17.uf2](https://micropython.org/resources/firmware/rp2-pico-20210902-v1.17.uf2), place it in the rp2040js root directory, then run:

```
npm install
npm run start:micropython
```

and enjoy the MicroPython REPL! Quit the REPL with Ctrl+D.

You can replace rp2-pico-20210902-v1.17.uf2 any recent MicroPython or CircuitPython release built for the RP2040.

## Learn more

- [Live-coding stream playlist](https://www.youtube.com/playlist?list=PLLomdjsHtJTxT-vdJHwa3z62dFXZnzYBm)
- [Hackaday project page](https://hackaday.io/project/177082-raspberry-pi-pico-emulator)

## License

Released under the MIT licence. Copyright (c) 2021, Uri Shaked.
