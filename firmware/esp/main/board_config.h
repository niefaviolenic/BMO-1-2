#ifndef BOARD_CONFIG_H
#define BOARD_CONFIG_H

#include <stdint.h>
#include <stdbool.h>

#if defined(CONFIG_JOY_BOARD_PROFILE_BMO_V2) || defined(JOY_BOARD_PROFILE_BMO_V2)
    #define BOARD_PROFILE_NAME "bmo_v2"

    // 3.5-inch HX8357-B 8-bit Intel 8080 bus LCD
    #define PIN_LCD_D0   12
    #define PIN_LCD_D1   13
    #define PIN_LCD_D2   18
    #define PIN_LCD_D3   3
    #define PIN_LCD_D4   46
    #define PIN_LCD_D5   9
    #define PIN_LCD_D6   10
    #define PIN_LCD_D7   11

    #define PIN_LCD_RD   (-1) // Write-only to avoid GPIO 15 conflict
    #define PIN_LCD_WR   7
    #define PIN_LCD_RS   6
    #define PIN_LCD_CS   5
    #define PIN_LCD_RST  4

    // Speaker pins (MAX98357A I2S DAC Amplifier)
    #define PIN_I2S_SPK_BCLK 16
    #define PIN_I2S_SPK_WS   14
    #define PIN_I2S_SPK_DIN  17

    // Microphone I2S pins (SD=1, SCK=2, WS=42)
    #define PIN_I2S_MIC_BCLK 2   // SCK (Clock)
    #define PIN_I2S_MIC_WS   42  // WS (Word Select / LRCLK)
    #define PIN_I2S_MIC_DIN  1   // SD (Serial Data into ESP32)

    #define PIN_TOUCH_PAD 41 // Digital touch sensor I/O on GPIO 41

    // 7 Physical buttons confirmed by hardware team
    #define PIN_BTN_VOICE        20  // A1 (Segitiga)
    #define PIN_BTN_PAIR         21  // A2 (Bulat kecil)
    #define PIN_BTN_EXPRESSION   47  // A3 (Bulat besar)
    #define PIN_BTN_VOL_UP       48  // A4 (Atas)
    #define PIN_BTN_VOL_DOWN     45  // A5 (Bawah, moved from 15 to avoid LCD_RD conflict)
    #define PIN_BTN_SPOTIFY_NEXT 0   // A6 (Kanan)
    #define PIN_BTN_SPOTIFY_PREV 38  // A7 (Kiri, moved from 35 to avoid Octal PSRAM conflict)
    #if !defined(PIN_BTN_VOICE) || (PIN_BTN_VOICE < 0)
        #error "PIN_BTN_VOICE must be defined and >= 0 for bmo_v2 production board profile"
    #endif
    #if !defined(PIN_BTN_PAIR) || (PIN_BTN_PAIR < 0)
        #error "PIN_BTN_PAIR must be defined and >= 0 for bmo_v2 production board profile"
    #endif
    #if !defined(PIN_BTN_EXPRESSION) || (PIN_BTN_EXPRESSION < 0)
        #error "PIN_BTN_EXPRESSION must be defined and >= 0 for bmo_v2 production board profile"
    #endif
    #if !defined(PIN_BTN_VOL_UP) || (PIN_BTN_VOL_UP < 0)
        #error "PIN_BTN_VOL_UP must be defined and >= 0 for bmo_v2 production board profile"
    #endif
    #if !defined(PIN_BTN_VOL_DOWN) || (PIN_BTN_VOL_DOWN < 0)
        #error "PIN_BTN_VOL_DOWN must be defined and >= 0 for bmo_v2 production board profile"
    #endif
    #if !defined(PIN_BTN_SPOTIFY_NEXT) || (PIN_BTN_SPOTIFY_NEXT < 0)
        #error "PIN_BTN_SPOTIFY_NEXT must be defined and >= 0 for bmo_v2 production board profile"
    #endif
    #if !defined(PIN_BTN_SPOTIFY_PREV) || (PIN_BTN_SPOTIFY_PREV < 0)
        #error "PIN_BTN_SPOTIFY_PREV must be defined and >= 0 for bmo_v2 production board profile"
    #endif
#elif defined(CONFIG_JOY_BOARD_PROFILE_BMO_V2_REFERENCE) || defined(JOY_BOARD_PROFILE_BMO_V2_REFERENCE)
    #define BOARD_PROFILE_NAME "bmo_v2_reference"

    // 3.5-inch HX8357-B 8-bit Intel 8080 bus LCD (sync with production)
    #define PIN_LCD_D0   12
    #define PIN_LCD_D1   13
    #define PIN_LCD_D2   18
    #define PIN_LCD_D3   3
    #define PIN_LCD_D4   46
    #define PIN_LCD_D5   9
    #define PIN_LCD_D6   10
    #define PIN_LCD_D7   11
    #define PIN_LCD_RD   (-1)
    #define PIN_LCD_WR   7
    #define PIN_LCD_RS   6
    #define PIN_LCD_CS   5
    #define PIN_LCD_RST  4

    // Speaker pins (MAX98357A I2S DAC Amplifier)
    #define PIN_I2S_SPK_BCLK 16
    #define PIN_I2S_SPK_WS   14
    #define PIN_I2S_SPK_DIN  17

    #define PIN_I2S_MIC_BCLK 2   // SCK
    #define PIN_I2S_MIC_WS   42  // WS
    #define PIN_I2S_MIC_DIN  1   // SD

    #define PIN_TOUCH_PAD    41

    #define PIN_BTN_VOICE        20  // A1 (Segitiga)
    #define PIN_BTN_PAIR         21  // A2 (Bulat kecil)
    #define PIN_BTN_EXPRESSION   47  // A3 (Bulat besar)
    #define PIN_BTN_VOL_UP       48  // A4 (Atas)
    #define PIN_BTN_VOL_DOWN     45  // A5 (Bawah)
    #define PIN_BTN_SPOTIFY_NEXT 0   // A6 (Kanan)
    #define PIN_BTN_SPOTIFY_PREV 38  // A7 (Kiri)
#else
    #define BOARD_PROFILE_NAME "legacy_v1"

    #define PIN_LCD_MOSI 11
    #define PIN_LCD_MISO 13
    #define PIN_LCD_SCLK 12
    #define PIN_LCD_CS   10
    #define PIN_LCD_DC   9
    #define PIN_LCD_RST  8

    #define PIN_I2S_SPK_BCLK 16
    #define PIN_I2S_SPK_WS   14
    #define PIN_I2S_SPK_DIN  17

    #define PIN_I2S_MIC_BCLK 2
    #define PIN_I2S_MIC_WS   42
    #define PIN_I2S_MIC_DIN  1

    #define PIN_TOUCH_PAD 14
    #define PIN_BOOT_BTN  0
    #define PIN_VOL_UP    15
    #define PIN_VOL_DOWN  16
    #define PIN_EXPRESSION 17

    #define PIN_BTN_VOICE        (-1)
    #define PIN_BTN_PAIR         (-1)
    #define PIN_BTN_EXPRESSION   (-1)
    #define PIN_BTN_VOL_UP       (-1)
    #define PIN_BTN_VOL_DOWN     (-1)
    #define PIN_BTN_SPOTIFY_NEXT (-1)
    #define PIN_BTN_SPOTIFY_PREV (-1)
#endif

#define BOARD_PIN_IS_ASSIGNED(pin) ((pin) >= 0)

#endif // BOARD_CONFIG_H
