cmake_minimum_required(VERSION 3.16)

option(
    JOY_HARDWARE_DEMO
    "Build a local-only hardware demo without production device credentials"
    OFF)

# Keep production credentials outside the repository, but allow each build
# machine to provide its own secure path. The historical path remains the
# default for the original workstation.
set(JOY_DEVICE_ID_FROM_ENV "")
set(JOY_DEVICE_TOKEN_FROM_ENV "")
set(JOY_DEVICE_ID_COUNT 0)
set(JOY_DEVICE_TOKEN_COUNT 0)

if(JOY_HARDWARE_DEMO)
    set(JOY_DEVICE_ID_FROM_ENV "joy-001")
    set(JOY_DEVICE_TOKEN_FROM_ENV "joy-hardware-demo-no-auth")
    set(JOY_DEVICE_ID_COUNT 1)
    set(JOY_DEVICE_TOKEN_COUNT 1)
    message(WARNING "JOY_HARDWARE_DEMO is enabled; this firmware cannot authenticate to production.")
else()
    if(DEFINED ENV{JOY_PRODUCTION_ENV_FILE} AND NOT "$ENV{JOY_PRODUCTION_ENV_FILE}" STREQUAL "" AND EXISTS "$ENV{JOY_PRODUCTION_ENV_FILE}")
        file(TO_CMAKE_PATH "$ENV{JOY_PRODUCTION_ENV_FILE}" JOY_PRODUCTION_ENV_FILE)
    elseif(DEFINED ENV{BMO_PRODUCTION_ENV_FILE} AND NOT "$ENV{BMO_PRODUCTION_ENV_FILE}" STREQUAL "" AND EXISTS "$ENV{BMO_PRODUCTION_ENV_FILE}")
        file(TO_CMAKE_PATH "$ENV{BMO_PRODUCTION_ENV_FILE}" JOY_PRODUCTION_ENV_FILE)
    elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/joy-production.env")
        set(JOY_PRODUCTION_ENV_FILE "${CMAKE_CURRENT_SOURCE_DIR}/joy-production.env")
    elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/bmo-production.env")
        set(JOY_PRODUCTION_ENV_FILE "${CMAKE_CURRENT_SOURCE_DIR}/bmo-production.env")
    elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../joy-production.env")
        set(JOY_PRODUCTION_ENV_FILE "${CMAKE_CURRENT_SOURCE_DIR}/../joy-production.env")
    elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../bmo-production.env")
        set(JOY_PRODUCTION_ENV_FILE "${CMAKE_CURRENT_SOURCE_DIR}/../bmo-production.env")
    else()
        set(JOY_PRODUCTION_ENV_FILE "D:/Joy/private/joy-production.env")
    endif()

    if(NOT EXISTS "${JOY_PRODUCTION_ENV_FILE}")
        message(FATAL_ERROR "Production credential file is missing: ${JOY_PRODUCTION_ENV_FILE}")
    endif()

    file(STRINGS "${JOY_PRODUCTION_ENV_FILE}" JOY_PRODUCTION_ENV_LINES)
    foreach(JOY_ENV_LINE IN LISTS JOY_PRODUCTION_ENV_LINES)
        string(REGEX MATCH "^[ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(.*)$" JOY_ENV_MATCH "${JOY_ENV_LINE}")
        if(JOY_ENV_MATCH)
            set(JOY_ENV_KEY "${CMAKE_MATCH_1}")
            set(JOY_ENV_VALUE "${CMAKE_MATCH_2}")
            string(STRIP "${JOY_ENV_VALUE}" JOY_ENV_VALUE)
            string(REGEX REPLACE "^\"(.*)\"$" "\\1" JOY_ENV_VALUE "${JOY_ENV_VALUE}")
            string(REGEX REPLACE "^'(.*)'$" "\\1" JOY_ENV_VALUE "${JOY_ENV_VALUE}")

            if(JOY_ENV_KEY STREQUAL "DEVICE_ID")
                math(EXPR JOY_DEVICE_ID_COUNT "${JOY_DEVICE_ID_COUNT} + 1")
                set(JOY_DEVICE_ID_FROM_ENV "${JOY_ENV_VALUE}")
            elseif(JOY_ENV_KEY STREQUAL "DEVICE_TOKEN")
                math(EXPR JOY_DEVICE_TOKEN_COUNT "${JOY_DEVICE_TOKEN_COUNT} + 1")
                set(JOY_DEVICE_TOKEN_FROM_ENV "${JOY_ENV_VALUE}")
            endif()
        endif()
    endforeach()
endif()

if(NOT JOY_DEVICE_ID_COUNT EQUAL 1 OR NOT JOY_DEVICE_ID_FROM_ENV STREQUAL "joy-001")
    message(FATAL_ERROR "Production credential file must contain exactly DEVICE_ID=joy-001")
endif()
if(NOT JOY_DEVICE_TOKEN_COUNT EQUAL 1 OR JOY_DEVICE_TOKEN_FROM_ENV STREQUAL "")
    message(FATAL_ERROR "Production credential file must contain exactly one non-empty DEVICE_TOKEN")
endif()
if(JOY_DEVICE_TOKEN_FROM_ENV MATCHES "[ \t\r\n\\\"]")
    message(FATAL_ERROR "Production DEVICE_TOKEN contains unsupported whitespace or quoting")
endif()

string(REPLACE "\\" "\\\\" JOY_DEVICE_TOKEN_ESCAPED "${JOY_DEVICE_TOKEN_FROM_ENV}")
string(REPLACE "\"" "\\\"" JOY_DEVICE_TOKEN_ESCAPED "${JOY_DEVICE_TOKEN_ESCAPED}")
set(JOY_CREDENTIAL_INCLUDE_DIR "${CMAKE_BINARY_DIR}/generated")
set(JOY_CREDENTIAL_HEADER "${JOY_CREDENTIAL_INCLUDE_DIR}/joy_credentials.h")
file(MAKE_DIRECTORY "${JOY_CREDENTIAL_INCLUDE_DIR}")

option(
    JOY_DEV_SUPPRESS_PAIRING_UI
    "Development-only: keep pairing protocol active while suppressing LCD code rendering"
    OFF)
if(JOY_DEV_SUPPRESS_PAIRING_UI)
    set(JOY_DEV_SUPPRESS_PAIRING_UI_VALUE 1)
else()
    set(JOY_DEV_SUPPRESS_PAIRING_UI_VALUE 0)
endif()

set(JOY_DEV_CONFIG_HEADER "${JOY_CREDENTIAL_INCLUDE_DIR}/joy_dev_config.h")
file(GENERATE
    OUTPUT "${JOY_DEV_CONFIG_HEADER}"
    CONTENT "#pragma once\n#define JOY_DEV_SUPPRESS_PAIRING_UI ${JOY_DEV_SUPPRESS_PAIRING_UI_VALUE}\n")
file(GENERATE
    OUTPUT "${JOY_CREDENTIAL_HEADER}"
    CONTENT "#pragma once\n#define JOY_DEVICE_ID \"${JOY_DEVICE_ID_FROM_ENV}\"\n#define JOY_DEVICE_TOKEN \"${JOY_DEVICE_TOKEN_ESCAPED}\"\n")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(all_joy)
