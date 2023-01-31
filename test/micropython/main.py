import time
import sys

version = sys.implementation.version
versionstr = "{}.{}.{}".format(version[0], version[1], version[2])

while True:
    print("Hello, MicroPython! version: {}".format(versionstr))
    time.sleep(1)
