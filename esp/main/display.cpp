#include "display.h"
#include "qrcodegen.h"

#include <math.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "driver/gpio.h"

#include "esp_err.h"
#include "esp_heap_caps.h"
#include "esp_lcd_io_i80.h"
#include "esp_lcd_panel_io.h"
#include "esp_log.h"
#include "esp_rom_sys.h"

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

static const char *TAG = "DISPLAY";

//--------------------------------------------------
// 3.5-inch UNO TFT: HX8357-B, 8-bit Intel 8080 bus
//--------------------------------------------------

#define LCD_PIN_D0   GPIO_NUM_12
#define LCD_PIN_D1   GPIO_NUM_13
#define LCD_PIN_D2   GPIO_NUM_18
#define LCD_PIN_D3   GPIO_NUM_3
#define LCD_PIN_D4   GPIO_NUM_46
#define LCD_PIN_D5   GPIO_NUM_9
#define LCD_PIN_D6   GPIO_NUM_10
#define LCD_PIN_D7   GPIO_NUM_11
#define LCD_PIN_RD   GPIO_NUM_15
#define LCD_PIN_WR   GPIO_NUM_7
#define LCD_PIN_RS   GPIO_NUM_6
#define LCD_PIN_CS   GPIO_NUM_5
#define LCD_PIN_RST  GPIO_NUM_4

// Backlight masih langsung ke 3V3, jadi tidak dikontrol software.
#define LCD_PIN_BL   (-1)

//--------------------------------------------------

#define LCD_H_RES 320
#define LCD_V_RES 240

// The UNO-style HX8357-B panel is natively 320x480.  Rotation 1 makes the
// physical display 480x320; keep the existing 320x240 face canvas and scale
// it to the full panel during flush.
#define LCD_PANEL_H_RES 480
#define LCD_PANEL_V_RES 320
#define LCD_PIXEL_CLOCK_HZ (2 * 1000 * 1000)

#define LCD_CMD_BITS 8
#define LCD_PARAM_BITS 8

#define LCD_DRAW_LINES 8

//--------------------------------------------------

static esp_lcd_i80_bus_handle_t lcd_bus_handle = NULL;
static esp_lcd_panel_io_handle_t lcd_io_handle = NULL;
static uint16_t *draw_buffers[2] = {NULL, NULL};
static uint16_t *frame_buffer = NULL;

static SemaphoreHandle_t display_mutex = NULL;

static bool display_ready = false;
static bool display_on = false;

static const gpio_num_t LCD_DATA_PINS[8] = {
    LCD_PIN_D0,
    LCD_PIN_D1,
    LCD_PIN_D2,
    LCD_PIN_D3,
    LCD_PIN_D4,
    LCD_PIN_D5,
    LCD_PIN_D6,
    LCD_PIN_D7,
};

static constexpr int FACE_CX = LCD_H_RES / 2;
static constexpr int FACE_CY = LCD_V_RES / 2;
static constexpr int TOUCH_FACE_COUNT =
    static_cast<int>(FACE_CONFUSED) + 1;

static DisplayMode current_display_mode = DisplayMode::IDLE;
static Face current_touch_face = FACE_HAPPY;
static bool pairing_code_active = false;
static char pairing_code[7] = {};
static time_t pairing_expires_at_epoch = 0;
static int pairing_total_duration_sec = 0;
static int last_rendered_fill_width = -1;
static constexpr int QR_MAX_VERSION = 15;
static constexpr size_t QR_BUFFER_LEN = qrcodegen_BUFFER_LEN_FOR_VERSION(QR_MAX_VERSION);
static bool qr_code_active = false;
static uint8_t qr_matrix[QR_BUFFER_LEN] = {};
static time_t qr_expires_at_epoch = 0;
static int qr_total_duration_sec = 0;

static const char *face_name(Face face)
{
    switch(face)
    {
        case FACE_HAPPY: return "HAPPY";
        case FACE_CUTE: return "CUTE";
        case FACE_EXCITED: return "EXCITED";
        case FACE_SLEEPY: return "SLEEPY";
        case FACE_ANGRY: return "ANGRY";
        case FACE_SAD: return "SAD";
        case FACE_WINK: return "WINK";
        case FACE_SURPRISED: return "SURPRISED";
        case FACE_LOVE: return "LOVE";
        case FACE_CONFUSED: return "CONFUSED";
        default: return "UNKNOWN";
    }
}

static const char *display_mode_name(DisplayMode mode)
{
    switch(mode)
    {
        case DisplayMode::IDLE: return "IDLE";
        case DisplayMode::LISTENING: return "LISTENING";
        case DisplayMode::THINKING: return "THINKING";
        case DisplayMode::SPEAKING: return "SPEAKING";
        case DisplayMode::ERROR: return "ERROR";
        default: return "UNKNOWN";
    }
}

static constexpr int PAIRING_GLYPH_COLUMNS = 5;
static constexpr int PAIRING_GLYPH_ROWS = 7;
static constexpr int PAIRING_GLYPH_SCALE_X = 7;
static constexpr int PAIRING_GLYPH_SCALE_Y = 9;
static constexpr int PAIRING_DIGIT_WIDTH = 35;
static constexpr int PAIRING_DIGIT_HEIGHT = 63;
static constexpr int PAIRING_DIGIT_GAP = 7;
static constexpr int PAIRING_TOTAL_WIDTH =
    6 * PAIRING_DIGIT_WIDTH + 5 * PAIRING_DIGIT_GAP;
static constexpr int PAIRING_START_X =
    (LCD_H_RES - PAIRING_TOTAL_WIDTH) / 2;
static constexpr int PAIRING_START_Y =
    (LCD_V_RES - PAIRING_DIGIT_HEIGHT) / 2;

static_assert(
    PAIRING_START_X >= 32 &&
        PAIRING_START_X + PAIRING_TOTAL_WIDTH <= LCD_H_RES - 32,
    "Pairing row must fit inside the user-horizontal face axis");
static_assert(
    PAIRING_START_Y >= 32 &&
        PAIRING_START_Y + PAIRING_DIGIT_HEIGHT <= LCD_V_RES - 32,
    "Pairing digit must fit inside the user-vertical face axis");
static constexpr int PAIRING_BAR_Y = 172;
static constexpr int PAIRING_BAR_HEIGHT = 6;

static_assert(
    PAIRING_BAR_Y >= 32 &&
        PAIRING_BAR_Y + PAIRING_BAR_HEIGHT <= LCD_V_RES - 32,
    "Pairing bar must fit inside the user-vertical face axis");

//--------------------------------------------------

static constexpr uint16_t rgb565(
    uint8_t r,
    uint8_t g,
    uint8_t b)
{
    return static_cast<uint16_t>(
        ((r & 0xF8) << 8) |
        ((g & 0xFC) << 3) |
        (b >> 3));
}

//--------------------------------------------------

static constexpr uint16_t COLOR_BODY   = 0x5F5C;
static constexpr uint16_t COLOR_FACE   = 0xDFF7;
static constexpr uint16_t COLOR_BORDER = 0x0320;
static constexpr uint16_t COLOR_BLACK  = 0x0000;
static constexpr uint16_t COLOR_WHITE  = 0xFFFF;
static constexpr uint16_t COLOR_PINK   = 0xF81F;
static constexpr uint16_t COLOR_RED    = 0xF800;
static constexpr uint16_t COLOR_BLUE   = 0x001F;
static constexpr uint16_t COLOR_YELLOW = 0xFFE0;
static constexpr uint16_t COLOR_ORANGE = 0xFD20;
static constexpr uint16_t COLOR_PURPLE = rgb565(130, 70, 180);

//--------------------------------------------------

static int clamp_value(
    int value,
    int min_value,
    int max_value)
{
    if(value < min_value)
        return min_value;

    if(value > max_value)
        return max_value;

    return value;
}

//--------------------------------------------------

static bool lock_display(
    TickType_t wait_ticks)
{
    if(display_mutex == NULL)
        return true;

    return xSemaphoreTake(
        display_mutex,
        wait_ticks) == pdTRUE;
}

//--------------------------------------------------

static void unlock_display()
{
    if(display_mutex != NULL)
        xSemaphoreGive(
            display_mutex);
}

//--------------------------------------------------

static uint64_t lcd_data_pin_mask()
{
    uint64_t mask = 0;
    for(gpio_num_t pin : LCD_DATA_PINS)
        mask |= 1ULL << pin;
    return mask;
}

static void lcd_probe_set_data_mode(gpio_mode_t mode)
{
    gpio_config_t config = {};
    config.pin_bit_mask = lcd_data_pin_mask();
    config.mode = mode;
    config.pull_up_en = GPIO_PULLUP_DISABLE;
    config.pull_down_en = GPIO_PULLDOWN_DISABLE;
    config.intr_type = GPIO_INTR_DISABLE;
    ESP_ERROR_CHECK(gpio_config(&config));
}

static void lcd_probe_write8(uint8_t value)
{
    for(int bit = 0; bit < 8; ++bit)
        ESP_ERROR_CHECK(gpio_set_level(LCD_DATA_PINS[bit], (value >> bit) & 1U));

    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_WR, 0));
    esp_rom_delay_us(3);
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_WR, 1));
    esp_rom_delay_us(3);
}

static uint8_t lcd_probe_read8()
{
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RD, 0));
    esp_rom_delay_us(6);

    uint8_t value = 0;
    for(int bit = 0; bit < 8; ++bit)
        value |= (uint8_t)(gpio_get_level(LCD_DATA_PINS[bit]) << bit);

    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RD, 1));
    esp_rom_delay_us(6);
    return value;
}

static void lcd_probe_read_register(
    uint16_t command,
    bool command_is_16_bit,
    uint8_t *result,
    size_t result_size)
{
    lcd_probe_set_data_mode(GPIO_MODE_OUTPUT);

    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_CS, 0));
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RS, 0));
    if(command_is_16_bit)
        lcd_probe_write8((uint8_t)(command >> 8));
    lcd_probe_write8((uint8_t)command);

    lcd_probe_set_data_mode(GPIO_MODE_INPUT);
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RS, 1));
    esp_rom_delay_us(10);

    for(size_t index = 0; index < result_size; ++index)
        result[index] = lcd_probe_read8();

    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_CS, 1));
    lcd_probe_set_data_mode(GPIO_MODE_OUTPUT);
}

static void lcd_probe_controller()
{
    gpio_config_t control_config = {};
    control_config.pin_bit_mask =
        (1ULL << LCD_PIN_RD) |
        (1ULL << LCD_PIN_WR) |
        (1ULL << LCD_PIN_RS) |
        (1ULL << LCD_PIN_CS) |
        (1ULL << LCD_PIN_RST);
    control_config.mode = GPIO_MODE_OUTPUT;
    control_config.pull_up_en = GPIO_PULLUP_DISABLE;
    control_config.pull_down_en = GPIO_PULLDOWN_DISABLE;
    control_config.intr_type = GPIO_INTR_DISABLE;
    ESP_ERROR_CHECK(gpio_config(&control_config));

    lcd_probe_set_data_mode(GPIO_MODE_OUTPUT);
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_CS, 1));
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RS, 1));
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_WR, 1));
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RD, 1));
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RST, 1));
    vTaskDelay(pdMS_TO_TICKS(20));
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RST, 0));
    vTaskDelay(pdMS_TO_TICKS(50));
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RST, 1));
    vTaskDelay(pdMS_TO_TICKS(120));

    uint8_t register_0000[4] = {};
    uint8_t register_d3[5] = {};
    uint8_t register_04[4] = {};
    uint8_t register_bf[6] = {};

    lcd_probe_read_register(0x0000, true, register_0000, sizeof(register_0000));
    lcd_probe_read_register(0x00D3, false, register_d3, sizeof(register_d3));
    lcd_probe_read_register(0x0004, false, register_04, sizeof(register_04));
    lcd_probe_read_register(0x00BF, false, register_bf, sizeof(register_bf));

    ESP_LOGI(TAG, "LCD_ID reg0000(16)=%02X %02X %02X %02X",
        register_0000[0], register_0000[1], register_0000[2], register_0000[3]);
    ESP_LOGI(TAG, "LCD_ID regD3(8)=%02X %02X %02X %02X %02X",
        register_d3[0], register_d3[1], register_d3[2], register_d3[3], register_d3[4]);
    ESP_LOGI(TAG, "LCD_ID reg04(8)=%02X %02X %02X %02X",
        register_04[0], register_04[1], register_04[2], register_04[3]);
    ESP_LOGI(TAG, "LCD_ID regBF(8)=%02X %02X %02X %02X %02X %02X",
        register_bf[0], register_bf[1], register_bf[2], register_bf[3],
        register_bf[4], register_bf[5]);

    if(register_bf[1] == 0x01 && register_bf[2] == 0x62 &&
       register_bf[3] == 0x83 && register_bf[4] == 0x57)
    {
        ESP_LOGI(TAG, "LCD controller identified: HX8357-B");
    }

    // Put the controller back into a known reset state before the I80 driver
    // takes ownership of the same pins.
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RST, 0));
    vTaskDelay(pdMS_TO_TICKS(20));
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RST, 1));
    vTaskDelay(pdMS_TO_TICKS(120));
}

//--------------------------------------------------

static void hx8357_write_command(
    uint8_t command,
    const uint8_t *data,
    size_t data_size)
{
    ESP_ERROR_CHECK(
        esp_lcd_panel_io_tx_param(
            lcd_io_handle,
            command,
            data,
            data_size));
}

static void hx8357_write_command1(
    uint8_t command,
    uint8_t value)
{
    const uint8_t data[] = {value};
    hx8357_write_command(command, data, sizeof(data));
}

//--------------------------------------------------

static void lcd_write_bitmap(
    int x0,
    int y0,
    int x1,
    int y1,
    const uint16_t *pixels)
{
    const uint8_t column_address[] = {
        (uint8_t)(x0 >> 8),
        (uint8_t)x0,
        (uint8_t)((x1 - 1) >> 8),
        (uint8_t)(x1 - 1)};
    const uint8_t page_address[] = {
        (uint8_t)(y0 >> 8),
        (uint8_t)y0,
        (uint8_t)((y1 - 1) >> 8),
        (uint8_t)(y1 - 1)};

    // HX8357-B uses the standard 8-bit MCU commands: 2Ah/2Bh set the
    // address window and 2Ch starts GRAM writes.
    hx8357_write_command(0x2A, column_address, sizeof(column_address));
    hx8357_write_command(0x2B, page_address, sizeof(page_address));

    const size_t pixel_count =
        (size_t)(x1 - x0) * (size_t)(y1 - y0);

    // RGB565 is sent MSB first on the 8-bit HX8357-B MCU bus.  The panel-IO
    // color-byte swap performs that ordering for the uint16_t framebuffer.
    ESP_ERROR_CHECK(
        esp_lcd_panel_io_tx_color(
            lcd_io_handle,
            0x2C,
            pixels,
            pixel_count * sizeof(uint16_t)));
}

//--------------------------------------------------

static void lcd_fill_physical_rect(
    int x0,
    int y0,
    int x1,
    int y1,
    uint16_t color)
{
    const int width = x1 - x0;
    if(width <= 0 || y1 <= y0 || draw_buffers[0] == NULL)
        return;

    for(int row = y0; row < y1; row += LCD_DRAW_LINES)
    {
        const int rows = (y1 - row > LCD_DRAW_LINES)
            ? LCD_DRAW_LINES
            : y1 - row;
        const int pixel_count = width * rows;

        for(int index = 0; index < pixel_count; ++index)
            draw_buffers[0][index] = color;

        lcd_write_bitmap(
            x0,
            row,
            x1,
            row + rows,
            draw_buffers[0]);
    }
}

//--------------------------------------------------

static void flush_framebuffer_locked()
{
    if(!display_ready || lcd_io_handle == NULL)
        return;

    if(frame_buffer != NULL && draw_buffers[0] != NULL && draw_buffers[1] != NULL)
    {
        int buf_idx = 0;
        for(int panel_row = 0; panel_row < LCD_PANEL_V_RES; panel_row += LCD_DRAW_LINES)
        {
            int rows = LCD_PANEL_V_RES - panel_row;
            if(rows > LCD_DRAW_LINES)
                rows = LCD_DRAW_LINES;

            uint16_t *current_draw_buffer = draw_buffers[buf_idx];
            for(int row = 0; row < rows; ++row)
            {
                const int source_y =
                    (panel_row + row) * LCD_V_RES / LCD_PANEL_V_RES;
                for(int column = 0; column < LCD_PANEL_H_RES; ++column)
                {
                    const int source_x =
                        column * LCD_H_RES / LCD_PANEL_H_RES;
                    current_draw_buffer[row * LCD_PANEL_H_RES + column] =
                        frame_buffer[source_y * LCD_H_RES + source_x];
                }
            }

            lcd_write_bitmap(
                0,
                panel_row,
                LCD_PANEL_H_RES,
                panel_row + rows,
                current_draw_buffer);

            buf_idx = 1 - buf_idx;
        }
    }
}

//--------------------------------------------------

static void fill_rect(
    int x,
    int y,
    int w,
    int h,
    uint16_t color)
{
    if(!display_ready)
        return;

    int x0 = clamp_value(x, 0, LCD_H_RES);
    int y0 = clamp_value(y, 0, LCD_V_RES);
    int x1 = clamp_value(x + w, 0, LCD_H_RES);
    int y1 = clamp_value(y + h, 0, LCD_V_RES);

    if(x1 <= x0)
        return;

    if(y1 <= y0)
        return;

    if(frame_buffer != NULL)
    {
        int width = x1 - x0;
        for(int row = y0; row < y1; row++)
        {
            uint16_t *dst = &frame_buffer[row * LCD_H_RES + x0];
            for(int col = 0; col < width; col++)
            {
                dst[col] = color;
            }
        }
        return;
    }
    if(draw_buffers[0] == NULL)
        return;

    const int panel_x0 = x0 * LCD_PANEL_H_RES / LCD_H_RES;
    const int panel_y0 = y0 * LCD_PANEL_V_RES / LCD_V_RES;
    const int panel_x1 =
        (x1 * LCD_PANEL_H_RES + LCD_H_RES - 1) / LCD_H_RES;
    const int panel_y1 =
        (y1 * LCD_PANEL_V_RES + LCD_V_RES - 1) / LCD_V_RES;
    lcd_fill_physical_rect(
        panel_x0,
        panel_y0,
        panel_x1,
        panel_y1,
        color);
}

//--------------------------------------------------

static void pixel(
    int x,
    int y,
    uint16_t color)
{
    if(frame_buffer != NULL)
    {
        if(x >= 0 && x < LCD_H_RES && y >= 0 && y < LCD_V_RES)
        {
            frame_buffer[y * LCD_H_RES + x] = color;
        }
        return;
    }

    fill_rect(x, y, 1, 1, color);
}

//--------------------------------------------------

static void line_basic(
    int x0,
    int y0,
    int x1,
    int y1,
    uint16_t color)
{
    int dx = abs(x1 - x0);
    int sx = x0 < x1 ? 1 : -1;

    int dy = -abs(y1 - y0);
    int sy = y0 < y1 ? 1 : -1;

    int err = dx + dy;

    while(true)
    {
        pixel(x0, y0, color);

        if(x0 == x1 && y0 == y1)
            break;

        int e2 = 2 * err;

        if(e2 >= dy)
        {
            err += dy;
            x0 += sx;
        }

        if(e2 <= dx)
        {
            err += dx;
            y0 += sy;
        }
    }
}

//--------------------------------------------------

static void thick_line(
    int x1,
    int y1,
    int x2,
    int y2,
    uint16_t color,
    int thickness)
{
    for(int i = -thickness / 2; i <= thickness / 2; i++)
    {
        line_basic(x1, y1 + i, x2, y2 + i, color);
        line_basic(x1 + i, y1, x2 + i, y2, color);
    }
}

//--------------------------------------------------

static void fill_circle(
    int cx,
    int cy,
    int r,
    uint16_t color)
{
    for(int dy = -r; dy <= r; dy++)
    {
        int xx = (int)sqrtf((float)(r * r - dy * dy));

        fill_rect(
            cx - xx,
            cy + dy,
            xx * 2 + 1,
            1,
            color);
    }
}

//--------------------------------------------------

static void fill_round_rect(
    int x,
    int y,
    int w,
    int h,
    int r,
    uint16_t color)
{
    if(r < 1)
    {
        fill_rect(x, y, w, h, color);
        return;
    }

    fill_rect(x + r, y, w - 2 * r, h, color);
    fill_rect(x, y + r, r, h - 2 * r, color);
    fill_rect(x + w - r, y + r, r, h - 2 * r, color);

    fill_circle(x + r, y + r, r, color);
    fill_circle(x + w - r - 1, y + r, r, color);
    fill_circle(x + r, y + h - r - 1, r, color);
    fill_circle(x + w - r - 1, y + h - r - 1, r, color);
}

//--------------------------------------------------

static int tri_sign(
    int x1,
    int y1,
    int x2,
    int y2,
    int x3,
    int y3)
{
    return
        (x1 - x3) * (y2 - y3) -
        (x2 - x3) * (y1 - y3);
}

//--------------------------------------------------

static void fill_triangle(
    int x1,
    int y1,
    int x2,
    int y2,
    int x3,
    int y3,
    uint16_t color)
{
    int min_x = x1;
    int max_x = x1;
    int min_y = y1;
    int max_y = y1;

    if(x2 < min_x)
        min_x = x2;
    if(x3 < min_x)
        min_x = x3;

    if(x2 > max_x)
        max_x = x2;
    if(x3 > max_x)
        max_x = x3;

    if(y2 < min_y)
        min_y = y2;
    if(y3 < min_y)
        min_y = y3;

    if(y2 > max_y)
        max_y = y2;
    if(y3 > max_y)
        max_y = y3;

    for(int y = min_y; y <= max_y; y++)
    {
        int row_min_x = LCD_H_RES;
        int row_max_x = -1;

        for(int x = min_x; x <= max_x; x++)
        {
            bool b1 = tri_sign(x, y, x1, y1, x2, y2) < 0;
            bool b2 = tri_sign(x, y, x2, y2, x3, y3) < 0;
            bool b3 = tri_sign(x, y, x3, y3, x1, y1) < 0;

            if((b1 == b2) && (b2 == b3))
            {
                if(x < row_min_x)
                    row_min_x = x;

                if(x > row_max_x)
                    row_max_x = x;
            }
        }

        if(row_max_x >= row_min_x)
        {
            fill_rect(
                row_min_x,
                y,
                row_max_x - row_min_x + 1,
                1,
                color);
        }
    }
}

//--------------------------------------------------

static void draw_curve(
    int x0,
    int y0,
    int x1,
    int y1,
    int x2,
    int y2,
    uint16_t color,
    int thickness)
{
    int last_x = x0;
    int last_y = y0;

    for(float t = 0.02f; t <= 1.0f; t += 0.02f)
    {
        float u = 1.0f - t;

        int x =
            (int)((u * u * x0) +
                  (2.0f * u * t * x1) +
                  (t * t * x2));

        int y =
            (int)((u * u * y0) +
                  (2.0f * u * t * y1) +
                  (t * t * y2));

        line_basic(last_x, last_y, x, y, color);
        fill_circle(x, y, thickness, color);

        last_x = x;
        last_y = y;
    }
}

//--------------------------------------------------

static void display_wake()
{
    if(display_on)
        return;

    hx8357_write_command(0x29, NULL, 0);

    vTaskDelay(
        pdMS_TO_TICKS(50));

    display_on = true;
}

//--------------------------------------------------

static void draw_screen_base()
{
    fill_rect(0, 0, LCD_H_RES, LCD_V_RES, COLOR_BODY);

    fill_round_rect(8, 8, 304, 224, 22, COLOR_BORDER);
    fill_round_rect(12, 12, 296, 216, 19, COLOR_BODY);

    fill_round_rect(28, 28, 264, 184, 22, COLOR_BLACK);
    fill_round_rect(32, 32, 256, 176, 18, COLOR_FACE);

    fill_circle(42, 220, 4, COLOR_BLACK);
    fill_circle(278, 220, 4, COLOR_BLACK);
}

//--------------------------------------------------

// Five-by-seven sans-serif-style bitmap glyphs. Each row uses its low five
// bits, with the leftmost glyph column in bit 4. They are intentionally
// rendered as ordinary block glyphs instead of seven-segment strokes.
static constexpr uint8_t PAIRING_NUMERIC_GLYPHS[10][PAIRING_GLYPH_ROWS] = {
    {0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E},
    {0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E},
    {0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F},
    {0x1E, 0x01, 0x01, 0x0E, 0x01, 0x01, 0x1E},
    {0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02},
    {0x1F, 0x10, 0x10, 0x1E, 0x01, 0x01, 0x1E},
    {0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E},
    {0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08},
    {0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E},
    {0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C},
};

static void pairing_fill_x_mirrored_rect(
    int x,
    int y,
    int width,
    int height,
    uint16_t color)
{
    const int compensated_x =
        LCD_H_RES - x - width;
    const int compensated_y = y;

    fill_rect(
        compensated_x,
        compensated_y,
        width,
        height,
        color);
}

static void draw_pairing_digit(
    int x,
    int y,
    uint8_t digit)
{
    if(digit > 9)
        return;

    for(int row = 0; row < PAIRING_GLYPH_ROWS; ++row)
    {
        const uint8_t bits = PAIRING_NUMERIC_GLYPHS[digit][row];

        for(int column = 0; column < PAIRING_GLYPH_COLUMNS; ++column)
        {
            if((bits & (1U << (PAIRING_GLYPH_COLUMNS - 1 - column))) != 0)
            {
                pairing_fill_x_mirrored_rect(
                    x + column * PAIRING_GLYPH_SCALE_X,
                    y + row * PAIRING_GLYPH_SCALE_Y,
                    PAIRING_GLYPH_SCALE_X,
                    PAIRING_GLYPH_SCALE_Y,
                    COLOR_BLACK);
            }
        }
    }
}

static void draw_pairing_overlay_locked()
{
    display_wake();
    draw_screen_base();

    for(int index = 0; index < 6; ++index)
    {
        const int x =
            PAIRING_START_X + index * (PAIRING_DIGIT_WIDTH + PAIRING_DIGIT_GAP);
        draw_pairing_digit(
            x,
            PAIRING_START_Y,
            static_cast<uint8_t>(pairing_code[index] - '0'));
    }

    if(pairing_expires_at_epoch > 0 && pairing_total_duration_sec > 0)
    {
        pairing_fill_x_mirrored_rect(
            PAIRING_START_X,
            PAIRING_BAR_Y,
            PAIRING_TOTAL_WIDTH,
            PAIRING_BAR_HEIGHT,
            COLOR_BLACK);

        const int inner_max_width = PAIRING_TOTAL_WIDTH - 2;
        const int inner_height = PAIRING_BAR_HEIGHT - 2;
        pairing_fill_x_mirrored_rect(
            PAIRING_START_X + 1,
            PAIRING_BAR_Y + 1,
            inner_max_width,
            inner_height,
            COLOR_WHITE);

        const time_t now_epoch = time(NULL);
        const int remaining_sec =
            (pairing_expires_at_epoch > now_epoch) ?
                static_cast<int>(pairing_expires_at_epoch - now_epoch) : 0;

        int fill_width = (remaining_sec * inner_max_width) / pairing_total_duration_sec;
        fill_width = clamp_value(fill_width, 0, inner_max_width);
        last_rendered_fill_width = fill_width;

        if(fill_width > 0)
        {
            pairing_fill_x_mirrored_rect(
                PAIRING_START_X + 1,
                PAIRING_BAR_Y + 1,
                fill_width,
                inner_height,
                COLOR_BLACK);
        }
    }

    flush_framebuffer_locked();
}

static void draw_qr_overlay_locked()
{
    display_wake();
    fill_rect(0, 0, LCD_H_RES, LCD_V_RES, COLOR_WHITE);

    const int qr_size = qrcodegen_getSize(qr_matrix);
    if(qr_size <= 0)
    {
        flush_framebuffer_locked();
        return;
    }

    const int quiet_zone_modules = 4;
    const int scale = clamp_value(LCD_V_RES / (qr_size + 2 * quiet_zone_modules), 1, 4);
    const int quiet_zone_px = quiet_zone_modules * scale;
    const int qr_pixel_size = qr_size * scale;
    const int total_qr_w = qr_pixel_size + 2 * quiet_zone_px;
    const int total_qr_h = total_qr_w;

    const int start_x = (LCD_H_RES - qr_pixel_size) / 2;
    const int start_y = (LCD_V_RES - qr_pixel_size) / 2;

    pairing_fill_x_mirrored_rect(
        start_x - quiet_zone_px,
        start_y - quiet_zone_px,
        total_qr_w,
        total_qr_h,
        COLOR_WHITE);

    for(int y = 0; y < qr_size; ++y)
    {
        for(int x = 0; x < qr_size; ++x)
        {
            if(qrcodegen_getModule(qr_matrix, x, y))
            {
                pairing_fill_x_mirrored_rect(
                    start_x + x * scale,
                    start_y + y * scale,
                    scale,
                    scale,
                    COLOR_BLACK);
            }
        }
    }

    flush_framebuffer_locked();
}
//--------------------------------------------------

static void clear_face_panel()
{
    fill_round_rect(32, 32, 256, 176, 18, COLOR_FACE);
}

//--------------------------------------------------

static void eye_round(
    int x,
    int y,
    int r)
{
    fill_circle(x, y, r, COLOR_BLACK);
}

//--------------------------------------------------

static void eye_big_cute(
    int x,
    int y)
{
    fill_circle(x, y, 18, COLOR_BLACK);
    fill_circle(x - 6, y - 7, 5, COLOR_WHITE);
    fill_circle(x + 5, y + 5, 3, COLOR_WHITE);
}

//--------------------------------------------------

static void eye_sleepy(
    int x,
    int y)
{
    thick_line(x - 18, y, x + 18, y, COLOR_BLACK, 4);
}

//--------------------------------------------------

static void eye_star(
    int x,
    int y)
{
    fill_triangle(x, y - 18, x - 6, y - 5, x + 6, y - 5, COLOR_BLACK);
    fill_triangle(x, y + 18, x - 6, y + 5, x + 6, y + 5, COLOR_BLACK);
    fill_triangle(x - 18, y, x - 5, y - 6, x - 5, y + 6, COLOR_BLACK);
    fill_triangle(x + 18, y, x + 5, y - 6, x + 5, y + 6, COLOR_BLACK);
    fill_circle(x, y, 7, COLOR_BLACK);
}

//--------------------------------------------------

static void eye_heart(
    int x,
    int y)
{
    fill_circle(x - 7, y - 5, 8, COLOR_RED);
    fill_circle(x + 7, y - 5, 8, COLOR_RED);
    fill_triangle(x - 16, y, x + 16, y, x, y + 20, COLOR_RED);
}

//--------------------------------------------------

static void blush()
{
    fill_circle(FACE_CX - 82, FACE_CY + 32, 9, COLOR_PINK);
    fill_circle(FACE_CX + 82, FACE_CY + 32, 9, COLOR_PINK);
}

//--------------------------------------------------

static void cheek_lines()
{
    thick_line(FACE_CX - 92, FACE_CY + 28, FACE_CX - 75, FACE_CY + 22, COLOR_PINK, 2);
    thick_line(FACE_CX - 92, FACE_CY + 39, FACE_CX - 75, FACE_CY + 33, COLOR_PINK, 2);

    thick_line(FACE_CX + 75, FACE_CY + 22, FACE_CX + 92, FACE_CY + 28, COLOR_PINK, 2);
    thick_line(FACE_CX + 75, FACE_CY + 33, FACE_CX + 92, FACE_CY + 39, COLOR_PINK, 2);
}

//--------------------------------------------------

static void mouth_smile()
{
    draw_curve(FACE_CX - 55, FACE_CY + 30, FACE_CX, FACE_CY + 72, FACE_CX + 55, FACE_CY + 30, COLOR_BLACK, 3);
}

//--------------------------------------------------

static void mouth_small_smile()
{
    draw_curve(FACE_CX - 32, FACE_CY + 36, FACE_CX, FACE_CY + 58, FACE_CX + 32, FACE_CY + 36, COLOR_BLACK, 3);
}

//--------------------------------------------------

static void mouth_laugh()
{
    fill_round_rect(FACE_CX - 45, FACE_CY + 26, 90, 48, 18, COLOR_BLACK);
    fill_round_rect(FACE_CX - 32, FACE_CY + 30, 64, 14, 8, COLOR_WHITE);
}

//--------------------------------------------------

static void mouth_tiny()
{
    fill_circle(FACE_CX, FACE_CY + 40, 6, COLOR_BLACK);
}

//--------------------------------------------------

static void mouth_open_small()
{
    fill_circle(FACE_CX, FACE_CY + 42, 16, COLOR_BLACK);
    fill_circle(FACE_CX, FACE_CY + 38, 6, COLOR_FACE);
}

//--------------------------------------------------

static void mouth_flat()
{
    fill_round_rect(FACE_CX - 45, FACE_CY + 48, 90, 7, 4, COLOR_BLACK);
}

//--------------------------------------------------

static void draw_microphone_indicator()
{
    // Sound wave arcs indicating listening / audio capture
    draw_curve(42, 42, 34, 54, 42, 66, COLOR_BLUE, 2);
    draw_curve(37, 36, 27, 54, 37, 72, COLOR_BLUE, 2);

    draw_curve(278, 42, 286, 54, 278, 66, COLOR_BLUE, 2);
    draw_curve(283, 36, 293, 54, 283, 72, COLOR_BLUE, 2);
}

//--------------------------------------------------

static void face_happy()
{
    clear_face_panel();

    eye_round(FACE_CX - 55, FACE_CY - 35, 13);
    eye_round(FACE_CX + 55, FACE_CY - 35, 13);

    mouth_smile();
    blush();
}

//--------------------------------------------------

static void face_cute()
{
    clear_face_panel();

    eye_big_cute(FACE_CX - 55, FACE_CY - 35);
    eye_big_cute(FACE_CX + 55, FACE_CY - 35);

    mouth_tiny();
    cheek_lines();
}

//--------------------------------------------------

static void face_listening()
{
    clear_face_panel();

    // Cute perked-up ears (outer black, inner pink)
    fill_triangle(58, 36, 40, 68, 80, 65, COLOR_BLACK);
    fill_triangle(59, 43, 46, 64, 74, 62, COLOR_PINK);

    fill_triangle(262, 36, 280, 68, 240, 65, COLOR_BLACK);
    fill_triangle(261, 43, 274, 64, 246, 62, COLOR_PINK);

    // Inquisitive / alert eyebrows
    thick_line(FACE_CX - 70, FACE_CY - 53, FACE_CX - 36, FACE_CY - 45, COLOR_BLACK, 3);
    thick_line(FACE_CX + 36, FACE_CY - 45, FACE_CX + 70, FACE_CY - 53, COLOR_BLACK, 3);

    // Cute big sparkling eyes
    eye_big_cute(FACE_CX - 55, FACE_CY - 25);
    eye_big_cute(FACE_CX + 55, FACE_CY - 25);

    // Rosy blush cheeks
    blush();

    // Cute open small mouth
    mouth_open_small();

    // Subtle sound wave listening indicator
    draw_microphone_indicator();
}

//--------------------------------------------------

static void face_excited()
{
    clear_face_panel();

    eye_star(FACE_CX - 55, FACE_CY - 35);
    eye_star(FACE_CX + 55, FACE_CY - 35);

    mouth_laugh();
    blush();
}

//--------------------------------------------------

static void face_sleepy()
{
    clear_face_panel();

    eye_sleepy(FACE_CX - 55, FACE_CY - 35);
    eye_sleepy(FACE_CX + 55, FACE_CY - 35);

    mouth_small_smile();
}

//--------------------------------------------------

static void face_angry()
{
    clear_face_panel();

    eye_round(FACE_CX - 55, FACE_CY - 30, 12);
    eye_round(FACE_CX + 55, FACE_CY - 30, 12);

    thick_line(FACE_CX - 82, FACE_CY - 65, FACE_CX - 35, FACE_CY - 45, COLOR_BLACK, 4);
    thick_line(FACE_CX + 35, FACE_CY - 45, FACE_CX + 82, FACE_CY - 65, COLOR_BLACK, 4);

    mouth_flat();

    fill_triangle(FACE_CX - 96, FACE_CY - 70, FACE_CX - 75, FACE_CY - 54, FACE_CX - 88, FACE_CY - 45, COLOR_RED);
    fill_triangle(FACE_CX + 96, FACE_CY - 70, FACE_CX + 75, FACE_CY - 54, FACE_CX + 88, FACE_CY - 45, COLOR_RED);
}

//--------------------------------------------------

static void face_sad()
{
    clear_face_panel();

    eye_round(FACE_CX - 55, FACE_CY - 35, 13);
    eye_round(FACE_CX + 55, FACE_CY - 35, 13);

    thick_line(FACE_CX - 80, FACE_CY - 60, FACE_CX - 35, FACE_CY - 68, COLOR_BLACK, 3);
    thick_line(FACE_CX + 35, FACE_CY - 68, FACE_CX + 80, FACE_CY - 60, COLOR_BLACK, 3);

    draw_curve(FACE_CX - 38, FACE_CY + 62, FACE_CX, FACE_CY + 32, FACE_CX + 38, FACE_CY + 62, COLOR_BLACK, 3);
    fill_circle(FACE_CX + 70, FACE_CY - 8, 5, COLOR_BLUE);
}

//--------------------------------------------------

static void face_wink()
{
    clear_face_panel();

    eye_sleepy(FACE_CX - 55, FACE_CY - 35);
    eye_round(FACE_CX + 55, FACE_CY - 35, 14);

    mouth_smile();
    cheek_lines();
}

//--------------------------------------------------

static void face_surprised()
{
    clear_face_panel();

    eye_round(FACE_CX - 55, FACE_CY - 38, 17);
    eye_round(FACE_CX + 55, FACE_CY - 38, 17);

    fill_circle(FACE_CX - 55, FACE_CY - 42, 5, COLOR_WHITE);
    fill_circle(FACE_CX + 55, FACE_CY - 42, 5, COLOR_WHITE);

    mouth_open_small();

    thick_line(FACE_CX - 78, FACE_CY - 72, FACE_CX - 35, FACE_CY - 80, COLOR_BLACK, 3);
    thick_line(FACE_CX + 35, FACE_CY - 80, FACE_CX + 78, FACE_CY - 72, COLOR_BLACK, 3);
}

//--------------------------------------------------

static void face_love()
{
    clear_face_panel();

    eye_heart(FACE_CX - 55, FACE_CY - 35);
    eye_heart(FACE_CX + 55, FACE_CY - 35);

    mouth_small_smile();
    blush();
}

//--------------------------------------------------

static void face_confused()
{
    clear_face_panel();

    eye_round(FACE_CX - 55, FACE_CY - 35, 13);
    eye_sleepy(FACE_CX + 55, FACE_CY - 35);

    thick_line(FACE_CX - 80, FACE_CY - 72, FACE_CX - 35, FACE_CY - 62, COLOR_BLACK, 3);
    thick_line(FACE_CX + 35, FACE_CY - 62, FACE_CX + 80, FACE_CY - 72, COLOR_BLACK, 3);

    fill_circle(FACE_CX, FACE_CY + 44, 6, COLOR_BLACK);
    fill_circle(FACE_CX + 42, FACE_CY + 35, 4, COLOR_PURPLE);
    fill_circle(FACE_CX + 55, FACE_CY + 23, 3, COLOR_ORANGE);
    fill_circle(FACE_CX + 68, FACE_CY + 36, 3, COLOR_YELLOW);
}

//--------------------------------------------------

static void draw_face_locked(
    Face face)
{
    display_wake();
    draw_screen_base();

    switch(face)
    {
        case FACE_HAPPY:
            face_happy();
            break;

        case FACE_CUTE:
            face_cute();
            break;

        case FACE_EXCITED:
            face_excited();
            break;

        case FACE_SLEEPY:
            face_sleepy();
            break;

        case FACE_ANGRY:
            face_angry();
            break;

        case FACE_SAD:
            face_sad();
            break;

        case FACE_WINK:
            face_wink();
            break;

        case FACE_SURPRISED:
            face_surprised();
            break;

        case FACE_LOVE:
            face_love();
            break;

        case FACE_CONFUSED:
            face_confused();
            break;

        default:
            face_excited();
            break;
    }

    flush_framebuffer_locked();

    ESP_LOGI(TAG, "Face actually rendered: %s(%d)", face_name(face), (int)face);
}

//--------------------------------------------------

static bool is_six_digit_pairing_code(
    const char *code)
{
    if(code == NULL || strlen(code) != 6)
        return false;

    for(int index = 0; index < 6; ++index)
    {
        if(code[index] < '0' || code[index] > '9')
            return false;
    }
    return true;
}

//--------------------------------------------------

static void secure_clear_pairing_code_locked()
{
    volatile char *cursor = pairing_code;
    for(size_t index = 0; index < sizeof(pairing_code); ++index)
        cursor[index] = '\0';
    pairing_expires_at_epoch = 0;
    pairing_total_duration_sec = 0;
    last_rendered_fill_width = -1;
}

static void secure_clear_qr_code_locked()
{
    volatile uint8_t *cursor = qr_matrix;
    for(size_t index = 0; index < sizeof(qr_matrix); ++index)
        cursor[index] = 0;
    qr_expires_at_epoch = 0;
    qr_total_duration_sec = 0;
}

//--------------------------------------------------

void display_init()
{
    ESP_LOGI(TAG, "Initialize HX8357-B 320x480 8-bit TFT");

    display_mutex =
        xSemaphoreCreateMutex();

    if(display_mutex == NULL)
    {
        ESP_LOGE(TAG, "Display mutex failed");
        return;
    }

    lcd_probe_controller();

    gpio_config_t rd_config = {};
    rd_config.pin_bit_mask = 1ULL << LCD_PIN_RD;
    rd_config.mode = GPIO_MODE_OUTPUT;
    rd_config.pull_up_en = GPIO_PULLUP_DISABLE;
    rd_config.pull_down_en = GPIO_PULLDOWN_DISABLE;
    rd_config.intr_type = GPIO_INTR_DISABLE;
    ESP_ERROR_CHECK(gpio_config(&rd_config));
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RD, 1));

    gpio_config_t reset_config = {};
    reset_config.pin_bit_mask = 1ULL << LCD_PIN_RST;
    reset_config.mode = GPIO_MODE_OUTPUT;
    reset_config.pull_up_en = GPIO_PULLUP_DISABLE;
    reset_config.pull_down_en = GPIO_PULLDOWN_DISABLE;
    reset_config.intr_type = GPIO_INTR_DISABLE;
    ESP_ERROR_CHECK(gpio_config(&reset_config));
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RST, 1));

    esp_lcd_i80_bus_config_t bus_config = {};
    bus_config.dc_gpio_num = LCD_PIN_RS;
    bus_config.wr_gpio_num = LCD_PIN_WR;
    bus_config.clk_src = LCD_CLK_SRC_DEFAULT;
    bus_config.data_gpio_nums[0] = LCD_PIN_D0;
    bus_config.data_gpio_nums[1] = LCD_PIN_D1;
    bus_config.data_gpio_nums[2] = LCD_PIN_D2;
    bus_config.data_gpio_nums[3] = LCD_PIN_D3;
    bus_config.data_gpio_nums[4] = LCD_PIN_D4;
    bus_config.data_gpio_nums[5] = LCD_PIN_D5;
    bus_config.data_gpio_nums[6] = LCD_PIN_D6;
    bus_config.data_gpio_nums[7] = LCD_PIN_D7;
    bus_config.bus_width = 8;
    bus_config.max_transfer_bytes =
        LCD_PANEL_H_RES * LCD_DRAW_LINES * sizeof(uint16_t);
    bus_config.dma_burst_size = 64;

    ESP_ERROR_CHECK(
        esp_lcd_new_i80_bus(
            &bus_config,
            &lcd_bus_handle));

    esp_lcd_panel_io_i80_config_t io_config = {};
    io_config.cs_gpio_num = LCD_PIN_CS;
    io_config.pclk_hz = LCD_PIXEL_CLOCK_HZ;
    io_config.trans_queue_depth = 4;
    // HX8357-B uses 8-bit commands and 8-bit parameters on the 8-bit 8080 bus.
    io_config.lcd_cmd_bits = LCD_CMD_BITS;
    io_config.lcd_param_bits = LCD_PARAM_BITS;
    io_config.dc_levels.dc_idle_level = 0;
    io_config.dc_levels.dc_cmd_level = 0;
    io_config.dc_levels.dc_dummy_level = 0;
    io_config.dc_levels.dc_data_level = 1;
    io_config.flags.swap_color_bytes = 1;

    ESP_ERROR_CHECK(
        esp_lcd_new_panel_io_i80(
            lcd_bus_handle,
            &io_config,
            &lcd_io_handle));

    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RST, 0));
    vTaskDelay(pdMS_TO_TICKS(20));
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RST, 1));
    vTaskDelay(pdMS_TO_TICKS(200));

    // HX8357-B initialization from the controller's UNO-style 8-bit setup.
    static const uint8_t power_control[] = {0x07, 0x42, 0x18};
    static const uint8_t vcom_control[] = {0x00, 0x07, 0x10};
    static const uint8_t power_normal[] = {0x01, 0x02};
    static const uint8_t panel_driving[] = {0x10, 0x3B, 0x00, 0x02, 0x11};
    static const uint8_t display_frame[] = {0x0C};
    static const uint8_t gamma[] = {
        0x00, 0x32, 0x36, 0x45, 0x06, 0x16,
        0x37, 0x75, 0x77, 0x54, 0x0C, 0x00};
    static const uint8_t display_mode[] = {0x00};

    hx8357_write_command(0x11, NULL, 0); // sleep out
    vTaskDelay(pdMS_TO_TICKS(20));
    hx8357_write_command(0xD0, power_control, sizeof(power_control));
    hx8357_write_command(0xD1, vcom_control, sizeof(vcom_control));
    hx8357_write_command(0xD2, power_normal, sizeof(power_normal));
    hx8357_write_command(0xC0, panel_driving, sizeof(panel_driving));
    hx8357_write_command(0xC5, display_frame, sizeof(display_frame));
    hx8357_write_command(0xC8, gamma, sizeof(gamma));
    hx8357_write_command1(0x36, 0x28); // landscape + BGR
    hx8357_write_command1(0x3A, 0x55); // RGB565 / 16-bit MCU pixels
    hx8357_write_command(0xB2, display_mode, sizeof(display_mode));

    const uint8_t column_address[] = {0x00, 0x00, 0x01, 0xDF};
    const uint8_t page_address[] = {0x00, 0x00, 0x01, 0x3F};
    hx8357_write_command(0x2A, column_address, sizeof(column_address));
    hx8357_write_command(0x2B, page_address, sizeof(page_address));

    vTaskDelay(pdMS_TO_TICKS(120));
    hx8357_write_command(0x29, NULL, 0); // display on
    vTaskDelay(pdMS_TO_TICKS(25));

    draw_buffers[0] =
        (uint16_t*)heap_caps_malloc(
            LCD_PANEL_H_RES *
            LCD_DRAW_LINES *
            sizeof(uint16_t),
            MALLOC_CAP_DMA);

    draw_buffers[1] =
        (uint16_t*)heap_caps_malloc(
            LCD_PANEL_H_RES *
            LCD_DRAW_LINES *
            sizeof(uint16_t),
            MALLOC_CAP_DMA);

    if(draw_buffers[0] == NULL || draw_buffers[1] == NULL)
    {
        ESP_LOGE(TAG, "DMA buffer failed");
        if(draw_buffers[0] != NULL)
        {
            free(draw_buffers[0]);
            draw_buffers[0] = NULL;
        }
        if(draw_buffers[1] != NULL)
        {
            free(draw_buffers[1]);
            draw_buffers[1] = NULL;
        }
        return;
    }

    frame_buffer =
        (uint16_t*)heap_caps_malloc(
            LCD_H_RES *
            LCD_V_RES *
            sizeof(uint16_t),
            MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);

    if(frame_buffer == NULL)
    {
        ESP_LOGW(TAG, "Frame buffer SPIRAM failed, trying internal malloc");
        frame_buffer =
            (uint16_t*)malloc(
                LCD_H_RES *
                LCD_V_RES *
                sizeof(uint16_t));
    }

    if(frame_buffer != NULL)
    {
        memset(frame_buffer, 0, LCD_H_RES * LCD_V_RES * sizeof(uint16_t));
    }

    display_ready = true;
    display_on = true;

    ESP_LOGI(TAG, "HX8357-B parallel TFT ready, logical=%dx%d panel=%dx%d",
        LCD_H_RES,
        LCD_V_RES,
        LCD_PANEL_H_RES,
        LCD_PANEL_V_RES);
}

//--------------------------------------------------

void display_sleep()
{
    if(!display_ready)
        return;

    if(!lock_display(pdMS_TO_TICKS(1000)))
        return;

    fill_rect(
        0,
        0,
        LCD_H_RES,
        LCD_V_RES,
        COLOR_BLACK);

    flush_framebuffer_locked();

    display_on = true;

    ESP_LOGI(TAG, "Display sleep screen");

    unlock_display();
}

//--------------------------------------------------

void display_test_pattern()
{
    if(!display_ready)
        return;

    if(!lock_display(pdMS_TO_TICKS(1000)))
        return;

    ESP_LOGI(TAG, "Display test pattern");

    display_wake();

    fill_rect(0, 0, LCD_H_RES, LCD_V_RES, COLOR_RED);
    flush_framebuffer_locked();
    vTaskDelay(pdMS_TO_TICKS(700));

    fill_rect(0, 0, LCD_H_RES, LCD_V_RES, COLOR_YELLOW);
    flush_framebuffer_locked();
    vTaskDelay(pdMS_TO_TICKS(700));

    fill_rect(0, 0, LCD_H_RES, LCD_V_RES, COLOR_BLUE);
    flush_framebuffer_locked();
    vTaskDelay(pdMS_TO_TICKS(700));

    fill_rect(0, 0, LCD_H_RES, LCD_V_RES, COLOR_WHITE);
    flush_framebuffer_locked();
    vTaskDelay(pdMS_TO_TICKS(700));
    unlock_display();
}

//--------------------------------------------------

void display_face(
    Face face)
{
    ESP_LOGI(TAG, "display_face()");

    if(!display_ready)
    {
        ESP_LOGW(TAG, "Display not ready");
        return;
    }

    if(!lock_display(pdMS_TO_TICKS(1000)))
    {
        ESP_LOGW(TAG, "Display busy");
        return;
    }

    if(current_display_mode == DisplayMode::IDLE && qr_code_active)
    {
        draw_qr_overlay_locked();
    }
    else if(current_display_mode == DisplayMode::IDLE && pairing_code_active)
    {
        draw_pairing_overlay_locked();
    }
    else
    {
        draw_face_locked(face);
    }

    unlock_display();
}

void display_set_idle_face(Face face)
{
    if(!lock_display(pdMS_TO_TICKS(1000)))
    {
        ESP_LOGW(TAG, "Display busy while setting idle face");
        return;
    }

    current_touch_face = face;

    if(display_ready && current_display_mode == DisplayMode::IDLE)
    {
        if(qr_code_active)
            draw_qr_overlay_locked();
        else if(pairing_code_active)
            draw_pairing_overlay_locked();
        else
            draw_face_locked(current_touch_face);
    }

    ESP_LOGI(TAG, "Idle face set: %s(%d)", face_name(current_touch_face), (int)current_touch_face);
    unlock_display();
}

Face display_next_touch_face()
{
    Face next_face = current_touch_face;

    if(!lock_display(pdMS_TO_TICKS(1000)))
        return next_face;

    const Face previous_face = current_touch_face;
    const int next_face_index =
        (static_cast<int>(current_touch_face) + 1) % TOUCH_FACE_COUNT;
    current_touch_face = static_cast<Face>(next_face_index);
    next_face = current_touch_face;

    if(display_ready && current_display_mode == DisplayMode::IDLE)
    {
        if(qr_code_active)
            draw_qr_overlay_locked();
        else if(pairing_code_active)
            draw_pairing_overlay_locked();
        else
            draw_face_locked(current_touch_face);
    }

    ESP_LOGI(
        TAG,
        "Idle face advance: before=%s(%d) after=%s(%d) render_requested=%d mode=%s",
        face_name(previous_face),
        (int)previous_face,
        face_name(current_touch_face),
        (int)current_touch_face,
        display_ready && current_display_mode == DisplayMode::IDLE ? 1 : 0,
        display_mode_name(current_display_mode));

    unlock_display();
    return next_face;
}

Face display_get_idle_face()
{
    Face face = current_touch_face;

    if(!lock_display(pdMS_TO_TICKS(1000)))
        return face;

    face = current_touch_face;
    unlock_display();
    return face;
}

void display_set_mode(DisplayMode mode)
{
    if(!lock_display(pdMS_TO_TICKS(1000)))
        return;

    current_display_mode = mode;
    ESP_LOGI(
        TAG,
        "Display mode=%s(%d)",
        display_mode_name(mode),
        (int)mode);

    if(!display_ready)
    {
        unlock_display();
        return;
    }

    if(mode == DisplayMode::IDLE && qr_code_active)
    {
        draw_qr_overlay_locked();
        unlock_display();
        return;
    }

    if(mode == DisplayMode::IDLE && pairing_code_active)
    {
        draw_pairing_overlay_locked();
        unlock_display();
        return;
    }

    switch(mode)
    {
        case DisplayMode::IDLE:
            draw_face_locked(current_touch_face);
            break;
        case DisplayMode::LISTENING:
            display_wake();
            draw_screen_base();
            face_listening();
            flush_framebuffer_locked();
            ESP_LOGI(TAG, "Face actually rendered: LISTENING");
            break;
        case DisplayMode::THINKING:
            draw_face_locked(FACE_CONFUSED);
            break;
        case DisplayMode::SPEAKING:
            draw_face_locked(FACE_HAPPY);
            break;
        case DisplayMode::ERROR:
            draw_face_locked(FACE_SAD);
            break;
    }

    unlock_display();
}

bool display_set_pairing_code(
    const char code[7],
    time_t expires_at_epoch)
{
    if(!is_six_digit_pairing_code(code))
        return false;

    if(!lock_display(pdMS_TO_TICKS(1000)))
        return false;

    if(pairing_code_active && memcmp(pairing_code, code, sizeof(pairing_code)) == 0 &&
       pairing_expires_at_epoch == expires_at_epoch)
    {
        unlock_display();
        return true;
    }

    secure_clear_pairing_code_locked();
    memcpy(pairing_code, code, 6);
    pairing_code[6] = '\0';
    pairing_expires_at_epoch = expires_at_epoch;
    if(expires_at_epoch > 0)
    {
        const time_t now_epoch = time(NULL);
        if(expires_at_epoch > now_epoch)
            pairing_total_duration_sec = static_cast<int>(expires_at_epoch - now_epoch);
        else
            pairing_total_duration_sec = 0;
    }
    pairing_code_active = true;

    if(display_ready && current_display_mode == DisplayMode::IDLE && !qr_code_active)
        draw_pairing_overlay_locked();
    unlock_display();
    return true;
}

void display_update_pairing_countdown()
{
    if(!lock_display(pdMS_TO_TICKS(100)))
        return;

    if(display_ready && display_on && pairing_code_active && !qr_code_active && current_display_mode == DisplayMode::IDLE &&
       pairing_expires_at_epoch > 0 && pairing_total_duration_sec > 0)
    {
        const time_t now_epoch = time(NULL);
        const int remaining_sec =
            (pairing_expires_at_epoch > now_epoch) ?
                static_cast<int>(pairing_expires_at_epoch - now_epoch) : 0;
        const int inner_max_width = PAIRING_TOTAL_WIDTH - 2;
        int fill_width = (remaining_sec * inner_max_width) / pairing_total_duration_sec;
        fill_width = clamp_value(fill_width, 0, inner_max_width);

        if(fill_width != last_rendered_fill_width)
        {
            draw_pairing_overlay_locked();
        }
    }

    unlock_display();
}

void display_clear_pairing_code()
{
    if(!lock_display(pdMS_TO_TICKS(1000)))
        return;

    if(!pairing_code_active)
    {
        secure_clear_pairing_code_locked();
        unlock_display();
        return;
    }

    const bool redraw_idle_face =
        display_ready && current_display_mode == DisplayMode::IDLE;
    secure_clear_pairing_code_locked();
    pairing_code_active = false;

    if(redraw_idle_face)
    {
        if(qr_code_active)
            draw_qr_overlay_locked();
        else
            draw_face_locked(current_touch_face);
    }

    unlock_display();
}

bool display_pairing_code_is_visible()
{
    if(!lock_display(pdMS_TO_TICKS(100)))
        return false;

    const bool visible =
        display_ready &&
        display_on &&
        pairing_code_active &&
        !qr_code_active &&
        current_display_mode == DisplayMode::IDLE;
    unlock_display();
    return visible;
}

bool display_set_qr_code(
    const char *qr_payload,
    time_t expires_at_epoch)
{
    if(qr_payload == NULL || strlen(qr_payload) == 0)
        return false;

    const time_t now_epoch = time(NULL);
    if(expires_at_epoch <= now_epoch)
        return false;

    if(!lock_display(pdMS_TO_TICKS(1000)))
        return false;

    uint8_t temp_buffer[QR_BUFFER_LEN];
    uint8_t new_matrix[QR_BUFFER_LEN];
    bool ok = qrcodegen_encodeText(
        qr_payload,
        temp_buffer,
        new_matrix,
        qrcodegen_Ecc_LOW,
        qrcodegen_VERSION_MIN,
        QR_MAX_VERSION,
        qrcodegen_Mask_AUTO,
        true);

    volatile uint8_t *v_temp = temp_buffer;
    for(size_t i = 0; i < sizeof(temp_buffer); ++i) v_temp[i] = 0;

    if(!ok)
    {
        volatile uint8_t *v_mat = new_matrix;
        for(size_t i = 0; i < sizeof(new_matrix); ++i) v_mat[i] = 0;
        unlock_display();
        return false;
    }

    if(qr_code_active && memcmp(qr_matrix, new_matrix, sizeof(qr_matrix)) == 0 &&
       qr_expires_at_epoch == expires_at_epoch)
    {
        volatile uint8_t *v_mat = new_matrix;
        for(size_t i = 0; i < sizeof(new_matrix); ++i) v_mat[i] = 0;
        unlock_display();
        return true;
    }

    secure_clear_qr_code_locked();
    memcpy(qr_matrix, new_matrix, sizeof(qr_matrix));
    volatile uint8_t *v_mat = new_matrix;
    for(size_t i = 0; i < sizeof(new_matrix); ++i) v_mat[i] = 0;

    qr_expires_at_epoch = expires_at_epoch;
    qr_total_duration_sec = static_cast<int>(expires_at_epoch - now_epoch);
    qr_code_active = true;

    if(display_ready && current_display_mode == DisplayMode::IDLE)
        draw_qr_overlay_locked();

    unlock_display();
    return true;
}

void display_update_qr_countdown()
{
    if(!lock_display(pdMS_TO_TICKS(100)))
        return;

    if(display_ready && display_on && qr_code_active && current_display_mode == DisplayMode::IDLE)
    {
        const time_t now_epoch = time(NULL);
        if(qr_expires_at_epoch > 0 && now_epoch >= qr_expires_at_epoch)
        {
            secure_clear_qr_code_locked();
            qr_code_active = false;
            if(pairing_code_active)
                draw_pairing_overlay_locked();
            else
                draw_face_locked(current_touch_face);
        }
    }

    unlock_display();
}

void display_clear_qr_code()
{
    if(!lock_display(pdMS_TO_TICKS(1000)))
        return;

    if(!qr_code_active)
    {
        secure_clear_qr_code_locked();
        unlock_display();
        return;
    }

    const bool redraw_idle_face =
        display_ready && current_display_mode == DisplayMode::IDLE;
    secure_clear_qr_code_locked();
    qr_code_active = false;

    if(redraw_idle_face)
    {
        if(pairing_code_active)
            draw_pairing_overlay_locked();
        else
            draw_face_locked(current_touch_face);
    }

    unlock_display();
}

bool display_qr_code_is_visible()
{
    if(!lock_display(pdMS_TO_TICKS(100)))
        return false;

    const bool visible =
        display_ready &&
        display_on &&
        qr_code_active &&
        current_display_mode == DisplayMode::IDLE;
    unlock_display();
    return visible;
}
