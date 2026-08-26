idf_component_register(
    SRCS "network.cpp" "state.cpp" "api.cpp" "playback.cpp" "wifi.cpp" "button.cpp" "wakeword.cpp" "audio.cpp" "display.cpp" "pairing.cpp" "main.cpp"
    INCLUDE_DIRS "."
    EMBED_FILES
        "audio_wav/01.wav"
        "audio_wav/02.wav"
        "audio_wav/03.wav"
        "audio_wav/04.wav"
        "audio_wav/05.wav"
        "audio_wav/06.wav"
        "audio_wav/07.wav"
        "audio_wav/08.wav"
        "audio_wav/09.wav"
        "audio_wav/10.wav"
        "audio_wav/wake_ack.wav"
    PRIV_INCLUDE_DIRS "${BMO_CREDENTIAL_INCLUDE_DIR}"
    REQUIRES
        driver
        esp_timer
        esp_driver_i2s
        esp_driver_spi
        esp_driver_gpio
        esp_lcd
        esp_lcd_ili9341
        esp-sr
        esp_wifi
        esp_event
        nvs_flash
        esp_netif
        esp_http_client
        esp_websocket_client
        mbedtls
)
