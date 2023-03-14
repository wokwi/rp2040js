cmake_minimum_required(VERSION 3.12)
include(pico_sdk_import.cmake)

project(dual-mcu C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

pico_sdk_init()

add_executable(dual-mcu-0
        dual-mcu.c
)

add_executable(dual-mcu-1
        dual-mcu.c
)

target_compile_options(dual-mcu-0 PRIVATE -Wall -DMCU0)
target_compile_options(dual-mcu-1 PRIVATE -Wall -DMCU1)

target_link_libraries(dual-mcu-0
        hardware_pio
        pico_stdlib
        pico_util
)

target_link_libraries(dual-mcu-1
        hardware_pio
        pico_stdlib
        pico_util
)

pico_enable_stdio_usb(dual-mcu-0 0)
pico_enable_stdio_uart(dual-mcu-0 1)
pico_enable_stdio_usb(dual-mcu-1 0)
pico_enable_stdio_uart(dual-mcu-1 1)

pico_generate_pio_header(dual-mcu-0 ${CMAKE_CURRENT_LIST_DIR}/dual-mcu.pio)
pico_generate_pio_header(dual-mcu-1 ${CMAKE_CURRENT_LIST_DIR}/dual-mcu.pio)

pico_add_extra_outputs(dual-mcu-0)
pico_add_extra_outputs(dual-mcu-1)
