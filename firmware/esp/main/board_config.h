#ifndef BOARD_CONFIG_H
#define BOARD_CONFIG_H

#include <stdint.h>
#include <stdbool.h>

#if defined(CONFIG_JOY_BOARD_PROFILE_BMO_V2) || defined(JOY_BOARD_PROFILE_BMO_V2)
    #define BOARD_PROFILE_NAME "bmo_v2"
    #ifndef PIN_BTN_VOICE
        #error "PIN_BTN_VOICE must be defined for bmo_v2 production board profile"
    #endif
    #ifndef PIN_BTN_PAIR
        #error "PIN_BTN_PAIR must be defined for bmo_v2 production board profile"
    #endif
    #ifndef PIN_BTN_EXPRESSION
        #error "PIN_BTN_EXPRESSION must be defined for bmo_v2 production board profile"
    #endif
    #ifndef PIN_BTN_VOL_UP
        #error "PIN_BTN_VOL_UP must be defined for bmo_v2 production board profile"
    #endif
    #ifndef PIN_BTN_VOL_DOWN
        #error "PIN_BTN_VOL_DOWN must be defined for bmo_v2 production board profile"
    #endif
    #ifndef PIN_BTN_SPOTIFY_NEXT
        #error "PIN_BTN_SPOTIFY_NEXT must be defined for bmo_v2 production board profile"
    #endif
    #ifndef PIN_BTN_SPOTIFY_PREV
        #error "PIN_BTN_SPOTIFY_PREV must be defined for bmo_v2 production board profile"
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
