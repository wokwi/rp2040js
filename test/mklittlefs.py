# Simple script to create a littlefs image for running the MicroPython test

from littlefs import LittleFS
from os.path import join

files = ['main.py']
source_dir = 'test/micropython'
output_image = 'littlefs.img'

lfs = LittleFS(block_size=4096, block_count=352, prog_size=256)
for filename in files:
    with open(join(source_dir, filename), 'r') as src_file, lfs.open(filename, 'w') as lfs_file:
        lfs_file.write(src_file.read())
with open(output_image, 'wb') as fh:
    fh.write(lfs.context.buffer)

print('Created littlefs image: {}'.format(output_image))
