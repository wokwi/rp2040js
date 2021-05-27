# rp2040js

A Raspberry Pi Pico Emulator (WiP). It blinks, runs Arduino code, and even the MicroPython REPL!

## Run the demo project

You'd need to get `hello_uart.hex` by building it from the [pico-examples repo](https://github.com/raspberrypi/pico-examples/tree/master/uart/hello_uart), then copy it to the rp2040js root directory and run:

```
npm install
npm start
```

To run the micropython demo, first download [rp2040-micropython-uart-47e6c52f0c.hex](https://raw.githubusercontent.com/wokwi/firmware-assets/gh-pages/rp2040-micropython-uart-47e6c52f0c.hex), rename it to `micropython.hex` and place it in the rp2040js root directory, then run:

```
npm install
npm run start:micropython
```

and enjoy the MicroPython REPL! Quit the REPL with Ctrl+D.

## Learn more

- [Live-coding stream playlist](https://www.youtube.com/playlist?list=PLLomdjsHtJTxT-vdJHwa3z62dFXZnzYBm)
- [Hackaday project page](https://hackaday.io/project/177082-raspberry-pi-pico-emulator)
- [Sign up to watch the next live stream](https://pages.wokwi.com/rp2040)

## License

Released under the MIT licence. Copyright (c) 2021, Uri Shaked.
