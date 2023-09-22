# Simple script to create a littlefs image for running the MicroPython test

from littlefs import LittleFS
from os.path import basename
from sys import argv

files = argv[2:]
# files = ['test/micropython/main.py']
output_image = argv[1]

lfs = LittleFS(block_size=4096, block_count=352, prog_size=256)
main = True
for filename in files:
    with open(filename, 'r') as src_file, lfs.open("main.py" if main else basename(filename), 'w') as lfs_file:
        lfs_file.write(src_file.read())
    main = False
with open(output_image, 'wb') as fh:
    fh.write(lfs.context.buffer)

print('Created littlefs image: {}'.format(output_image))
