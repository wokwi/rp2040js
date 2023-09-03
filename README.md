# rp2040js

Raspberry Pi Pico Emulator for the [Wokwi Simulation Platform](https://wokwi.com). It blinks, runs Arduino code, and even the MicroPython REPL!

## Online examples

If you are just looking to play around with the Raspberry Pi Pico Simulator, check out the Wokwi Simulator:

- [Raspberry Pi Pico Traffic Light](https://wokwi.com/arduino/projects/297322571959894536)
- [LCD1602 Hello World](https://wokwi.com/arduino/projects/297323005822894602)
- [MicroPython Blink](https://wokwi.com/arduino/projects/300504213470839309)
- [MicroPython 7-Segment Counter](https://wokwi.com/arduino/projects/300210834979684872)

For more information, take a look at the [wokwi-pi-pico docs](https://docs.wokwi.com/parts/wokwi-pi-pico) and the [Pi Pico MicroPython Guide](https://docs.wokwi.com/guides/micropython).

If you want to develop your own application using the Raspberry Pi Pico simulator, the following examples may be helpful:

- [Blink LEDs with RP2040js, from scratch](https://stackblitz.com/edit/rp2040js-blink?file=index.ts) - Press "Run" and patiently wait for the code to compile ;-)

## Run the demo project

### Native code

You'd need to get `hello_uart.hex` by building it from the [pico-examples repo](https://github.com/raspberrypi/pico-examples/tree/master/uart/hello_uart), then copy it to the rp2040js root directory and run:

```
npm install
npm start
```

### MicroPython code

To run the MicroPython demo, first download [RPI_PICO-20230426-v1.20.0.uf2](https://micropython.org/resources/firmware/RPI_PICO-20230426-v1.20.0.uf2), place it in the rp2040js root directory, then run:

```
npm install
npm run start:micropython
```

and enjoy the MicroPython REPL! Quit the REPL with Ctrl+X. A different MicroPython UF2 image can be loaded by supplying the `--image` option:

```
npm run start:micropython -- --image=my_image.uf2
```

A GDB server on port 3333 can be enabled by specifying the `--gdb` flag:

```
npm run start:micropython -- --gdb
```

For using the MicroPython demo code in tests, the `--expect-text` can come handy: it will look for the given text in the serial output and exit with code 0 if found, or 1 if not found. You can find an example in [the MicroPython CI test](./github/workflows/ci-micropython.yml).

#### Filesystem support

With MicroPython, you can use the filesystem on the Pico. This becomes useful as more than one script file is used in your code. Just put a [LittleFS](https://github.com/littlefs-project/littlefs) formatted filesystem image called `littlefs.img` into the rp2040js root directory, and your `main.py` will be automatically started from there.

A simple way to create a suitable LittleFS image containing your script files is outlined in [create_littlefs_image.py](https://github.com/tomods/GrinderController/blob/358ad3e0f795d8cc0bdf4f21bb35f806871d433f/tools/create_littlefs_image.py).
So, using [littlefs-python](https://pypi.org/project/littlefs-python/), you can do the following:

```python
from littlefs import LittleFS
files = ['your.py', 'files.py', 'here.py', 'main.py']
output_image = 'output/littlefs.img'  # symlinked/copied to rp2040js root directory
lfs = LittleFS(block_size=4096, block_count=352, prog_size=256)
for filename in files:
    with open(filename, 'rb') as src_file, lfs.open(filename, 'w') as lfs_file:
        lfs_file.write(src_file.read())
with open(output_image, 'wb') as fh:
    fh.write(lfs.context.buffer)
```

Other ways of creating LittleFS images can be found [here](https://github.com/wokwi/littlefs-wasm) or [here](https://github.com/littlefs-project/littlefs#related-projects).

Currently, the filesystem is not writeable, as the SSI peripheral required for flash writing is not implemented yet. If you're interested in hacking, see the discussion in https://github.com/wokwi/rp2040js/issues/88 for a workaround.

### CircuitPython code

To run the CircuitPython demo, you can follow the directions above for MicroPython, except download [adafruit-circuitpython-raspberry_pi_pico-en_US-8.0.2.uf2](https://adafruit-circuit-python.s3.amazonaws.com/bin/raspberry_pi_pico/en_US/adafruit-circuitpython-raspberry_pi_pico-en_US-8.0.2.uf2) instead of the MicroPython UF2 file. Place it in the rp2040js root directory, then run:

```
npm install
npm run start:circuitpython
```

and start the CircuitPython REPL! The rest of the experience is the same as the MicroPython demo (Ctrl+X to exit, using the `--image` and
`--gdb` options, etc).

#### Filesystem support

For CircuitPython, you can create a FAT12 filesystem in Linux using the `truncate` and `mkfs.vfat` utilities:

```shell
truncate fat12.img -s 1M  # make the image file
mkfs.vfat -F12 -S512 fat12.img  # create the FAT12 filesystem
```

You can then mount the filesystem image and add files to it:

```shell
mkdir fat12  # create the mounting folder if needed
sudo mount -o loop fat12.img fat12/  # mount the filesystem to the folder
sudo cp code.py fat12/  # copy code.py to the filesystem
sudo umount fat12/  # unmount the filesystem
```

While CircuitPython does not typically use a writeable filesystem, note that this functionality is unavailable (see MicroPython filesystem
support section for more details).

## Learn more

- [Live-coding stream playlist](https://www.youtube.com/playlist?list=PLLomdjsHtJTxT-vdJHwa3z62dFXZnzYBm)
- [Hackaday project page](https://hackaday.io/project/177082-raspberry-pi-pico-emulator)

## License

Released under the MIT licence. Copyright (c) 2021-2023, Uri Shaked.
