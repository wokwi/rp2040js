from machine import Pin, SPI

spi = SPI(0)
cs = Pin(5, Pin.OUT)
cs(1)

spi.init(baudrate=10 * 1024 * 1024, polarity=0, phase=0)
cs(0)
spi.write(b'hello world')
cs(1)

cs(0)
spi.write(b'h')
cs(1)

cs(0)
spi.write(b'0123456789abcdef0123456789abcdef0123456789abcdef')
cs(1)