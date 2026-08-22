idf_component_register(
    SRCS "network.cpp" "state.cpp" "api.cpp" "wifi.cpp" "button.cpp" "wakeword.cpp" "audio.cpp" "display.cpp" "main.cpp"
    INCLUDE_DIRS "."
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
