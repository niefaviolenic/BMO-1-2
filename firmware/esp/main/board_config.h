#ifndef BOARD_CONFIG_H
#define BOARD_CONFIG_H

#include <stdint.h>
#include <stdbool.h>

#if defined(CONFIG_JOY_BOARD_PROFILE_BMO_V2) || defined(JOY_BOARD_PROFILE_BMO_V2)
    #define BOARD_PROFILE_NAME "bmo_v2"

    #define PIN_LCD_MOSI 11
    #define PIN_LCD_MISO 13
    #define PIN_LCD_SCLK 12
    #define PIN_LCD_CS   10
    #define PIN_LCD_DC   9
    #define PIN_LCD_RST  8

    #define PIN_I2S_SPK_BCLK 1
    #define PIN_I2S_SPK_WS   2
    #define PIN_I2S_SPK_DIN  42

    #define PIN_I2S_MIC_BCLK 5
    #define PIN_I2S_MIC_WS   4
    #define PIN_I2S_MIC_DIN  6

    #define PIN_TOUCH_PAD 14

    // 7 Physical buttons confirmed by hardware team
    #define PIN_BTN_VOICE        20  // A1 (Segitiga)
    #define PIN_BTN_PAIR         21  // A2 (Bulat kecil)
    #define PIN_BTN_EXPRESSION   47  // A3 (Bulat besar)
    #define PIN_BTN_VOL_UP       48  // A4 (Atas)
    #define PIN_BTN_VOL_DOWN     15  // A5 (Bawah)
    #define PIN_BTN_SPOTIFY_NEXT 0   // A6 (Kanan)
    // GPIO 35 is reserved for Octal PSRAM (CONFIG_SPIRAM_MODE_OCT=y) on ESP32-S3.
    // Disabled (-1) to protect PSRAM bus from crashing until HW team reassigns.
    #define PIN_BTN_SPOTIFY_PREV (-1)
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
#elif defined(CONFIG_JOY_BOARD_PROFILE_BMO_V2_REFERENCE) || defined(JOY_BOARD_PROFILE_BMO_V2_REFERENCE)
    #define BOARD_PROFILE_NAME "bmo_v2_reference"

    #define PIN_LCD_MOSI 11
    #define PIN_LCD_MISO 13
    #define PIN_LCD_SCLK 12
    #define PIN_LCD_CS   10
    #define PIN_LCD_DC   9
    #define PIN_LCD_RST  8

    #define PIN_I2S_SPK_BCLK 1
    #define PIN_I2S_SPK_WS   2
    #define PIN_I2S_SPK_DIN  42

    #define PIN_I2S_MIC_BCLK 5
    #define PIN_I2S_MIC_WS   4
    #define PIN_I2S_MIC_DIN  6

    #define PIN_TOUCH_PAD 14

    // 7 dedicated inputs unassigned (-1) until hardware staff supplies replacement wiring
    #define PIN_BTN_VOICE        (-1)
    #define PIN_BTN_PAIR         (-1)
    #define PIN_BTN_EXPRESSION   (-1)
    #define PIN_BTN_VOL_UP       (-1)
    #define PIN_BTN_VOL_DOWN     (-1)
    #define PIN_BTN_SPOTIFY_NEXT (-1)
    #define PIN_BTN_SPOTIFY_PREV (-1)
#else
    #define BOARD_PROFILE_NAME "legacy_v1"

    #define PIN_LCD_MOSI 11
    #define PIN_LCD_MISO 13
    #define PIN_LCD_SCLK 12
    #define PIN_LCD_CS   10
    #define PIN_LCD_DC   9
    #define PIN_LCD_RST  8

    #define PIN_I2S_SPK_BCLK 1
    #define PIN_I2S_SPK_WS   2
    #define PIN_I2S_SPK_DIN  42

    #define PIN_I2S_MIC_BCLK 5
    #define PIN_I2S_MIC_WS   4
    #define PIN_I2S_MIC_DIN  6

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
