"""Exercises real internal-flash writes via the auto-mounted littlefs filesystem - the SSI
flash-write path, not just the SPI0 peripheral main-spi.py already covers. Writes a new file,
reads it back, and reports pass/fail as plain text so the harness can pick it up the same way
main.py's boot banner already does (--expect-text).
"""

import time

try:
    with open("flash_rw_test.txt", "w") as f:
        f.write("flash rw works")
    with open("flash_rw_test.txt", "r") as f:
        data = f.read()
    result = "FLASH RW OK" if data == "flash rw works" else "FLASH RW FAILED: unexpected content {!r}".format(data)
except Exception as exc:
    result = "FLASH RW FAILED: {}".format(exc)

while True:
    print(result)
    time.sleep(1)
