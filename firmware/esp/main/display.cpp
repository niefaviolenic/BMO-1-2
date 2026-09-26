#include "display.h"
#include "audio.h"
#include "qrcodegen.h"
#include "joy_identity.h"
#include "joy_ble_provisioning.h"
#include "face_assets.h"
#include "face_policy.h"

static FacePolicy s_face_policy;
#include "esp_timer.h"

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
// Data Pins (D0-D7): GPIO 12, 13, 18, 3, 46, 9, 10, 11
// Control Pins: WR=GPIO 7, RS=GPIO 6, CS=GPIO 5, RST=GPIO 4
// RD: Set -1 / write-only to prevent conflict with GPIO 15 (Volume Down)
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
#define LCD_PIN_BL   (-1)

#define LCD_H_RES 320
#define LCD_V_RES 240
#define LCD_PANEL_H_RES 480
#define LCD_PANEL_V_RES 320
#define LCD_PIXEL_CLOCK_HZ (2 * 1000 * 1000)

#define LCD_CMD_BITS 8
#define LCD_PARAM_BITS 8
#define LCD_DRAW_LINES 8

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
static bool ble_pairing_active = false;
static int ble_pairing_remaining_sec = 0;
static constexpr uint32_t SHY_DURATION_MS = 5000;
static inline void cancel_shy_animation() {}

static constexpr uint64_t UNPAIRED_FACE_REVERT_DELAY_US = 4000000ULL;
static esp_timer_handle_t unpaired_face_revert_timer = NULL;
static bool unpaired_revert_active = false;
static int s_unpaired_cycle_index = 0;

static bool is_unpaired_locked()
{
    const joy_runtime_creds_t *runtime = joy_runtime_get();
    if (runtime == NULL || !runtime->is_provisioned)
    {
        return true;
    }
    return (joy_ble_get_state() == JoyBleState::UNPAIRED_IDLE);
}

static void cancel_unpaired_revert_timer_locked()
{
    if(unpaired_face_revert_timer != NULL && unpaired_revert_active)
    {
        esp_timer_stop(unpaired_face_revert_timer);
        unpaired_revert_active = false;
    }
}

static void schedule_unpaired_revert_timer_locked()
{
    if(unpaired_face_revert_timer != NULL)
    {
        esp_timer_stop(unpaired_face_revert_timer);
        unpaired_revert_active = true;
        esp_timer_start_once(unpaired_face_revert_timer, UNPAIRED_FACE_REVERT_DELAY_US);
    }
}

static void unpaired_face_revert_timer_cb(void *arg);

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
        case FACE_DEAD: return "DEAD";
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

static constexpr uint16_t COLOR_BODY   = 0xCF17; // #bae0ce Mint Green (Screen BMO_320 x 240 (1).pdf)
static constexpr uint16_t COLOR_FACE   = 0xCF17; // #bae0ce Mint Green (Screen BMO_320 x 240 (1).pdf)
static constexpr uint16_t COLOR_BORDER = 0x0320;
static constexpr uint16_t COLOR_BLACK  = 0x0000;
static constexpr uint16_t COLOR_WHITE  = 0xFFFF;
static constexpr uint16_t COLOR_PINK   = 0xF81F;
static constexpr uint16_t COLOR_RED    = 0xF800;
static constexpr uint16_t COLOR_BLUE   = 0x00FC; // True Bluetooth Blue (R=0, G=129, B=255) on BGR panel
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
static void display_wake();

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

    hx8357_write_command(0x2A, column_address, sizeof(column_address));
    hx8357_write_command(0x2B, page_address, sizeof(page_address));

    const size_t pixel_count = (size_t)(x1 - x0) * (size_t)(y1 - y0);
    ESP_ERROR_CHECK(
        esp_lcd_panel_io_tx_color(
            lcd_io_handle,
            0x2C,
            pixels,
            pixel_count * sizeof(uint16_t)));
}

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
static void render_face_asset_locked(uint8_t asset_id)
{
    if (!display_ready || frame_buffer == NULL) return;

    const face_asset_t *asset = face_assets_get(asset_id);
    if (!asset || !asset->data) return;

    if (asset->is_rle) {
        size_t pixel_idx = 0;
        size_t total_pixels = (size_t)LCD_H_RES * (size_t)LCD_V_RES;
        for (size_t i = 0; i < asset->run_count * 2 && pixel_idx < total_pixels; i += 2) {
            uint16_t run_len = asset->data[i];
            uint16_t color = asset->data[i + 1];
            for (uint16_t r = 0; r < run_len && pixel_idx < total_pixels; ++r) {
                frame_buffer[pixel_idx++] = color;
            }
        }
    } else {
        memcpy(frame_buffer, asset->data, (size_t)LCD_H_RES * (size_t)LCD_V_RES * sizeof(uint16_t));
    }

    flush_framebuffer_locked();
}

void display_render_asset(uint8_t asset_id)
{
    if (!lock_display(pdMS_TO_TICKS(100))) return;
    display_wake();
    render_face_asset_locked(asset_id);
    unlock_display();
}

static void display_policy_task(void *param)
{
    while (true)
    {
        int64_t now_us = esp_timer_get_time();
        FaceDecision decision = s_face_policy.update(now_us);
        if (decision.face_changed) {
            display_render_asset(decision.asset_id);
            ESP_LOGI(TAG, ">>> [EXPRESSION TRANSITION] Face changed to Asset %d <<<", decision.asset_id);
        }
        int delay_ms = 20;
        if (decision.next_deadline_us > 0) {
            int64_t diff_ms = (decision.next_deadline_us - now_us) / 1000LL;
            if (diff_ms > 0 && diff_ms < 50) {
                delay_ms = (int)diff_ms;
                if (delay_ms < 5) delay_ms = 5;
            }
        }
        vTaskDelay(pdMS_TO_TICKS(delay_ms));
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

    hx8357_write_command(0x11, NULL, 0); // exit sleep
    vTaskDelay(pdMS_TO_TICKS(120));
    hx8357_write_command(0x29, NULL, 0); // display on
    display_on = true;
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

static inline int user_x_to_fb(int user_x)
{
    return LCD_H_RES - 1 - user_x;
}

static void draw_user_thick_line(int ux1, int uy1, int ux2, int uy2, uint16_t color, int thickness)
{
    thick_line(user_x_to_fb(ux1), uy1, user_x_to_fb(ux2), uy2, color, thickness);
}

static void draw_pairing_digit_scaled(
    int x,
    int y,
    uint8_t digit,
    int scale_x,
    int scale_y)
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
                    x + column * scale_x,
                    y + row * scale_y,
                    scale_x,
                    scale_y,
                    COLOR_BLACK);
            }
        }
    }
}

[[maybe_unused]] static void draw_pairing_digit(
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

static void draw_ble_pairing_overlay_locked()
{
    display_wake();
    render_face_asset_locked(1); // Asset 1: Pure V2 Borderless BLE Pairing Screen (NO TIMER)
    flush_framebuffer_locked();
    ESP_LOGI(TAG, "BLE pairing V2 screen rendered (timer disabled per user request)");
}

static void draw_pairing_overlay_locked()
{
    // Legacy 6-digit code overlay disabled: pairing is managed via BLE Scheme 2
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



static uint8_t face_to_v2_asset_id(Face face)
{
    switch(face)
    {
        case FACE_HAPPY:
        case FACE_SLEEPY:
        case FACE_WINK:
            return 3;  // Asset 3: IDLE / HAPPY
        case FACE_CUTE:
        case FACE_EXCITED:
        case FACE_LOVE:
            return 6;  // Asset 6: EXCITED / CUTE / SHY
        case FACE_ANGRY:
            return 11; // Asset 11: BAD FACE / ANGRY
        case FACE_SAD:
        case FACE_DEAD:
            return 14; // Asset 14: ERROR / SAD
        case FACE_SURPRISED:
            return 5;  // Asset 5: SURPRISED
        case FACE_CONFUSED:
            return 10; // Asset 10: THINKING frame 1
        default:
            return 3;
    }
}

static void draw_face_locked(Face face)
{
    display_wake();
    const uint8_t asset_id = face_to_v2_asset_id(face);
    render_face_asset_locked(asset_id);
    ESP_LOGI(TAG, "Face actually rendered (V2 Asset %d): %s(%d)",
             asset_id, face_name(face), (int)face);
}

static void unpaired_face_revert_timer_cb(void *arg)
{
    if(!lock_display(pdMS_TO_TICKS(500)))
        return;

    unpaired_revert_active = false;

    if(display_ready && current_display_mode == DisplayMode::IDLE &&
       !pairing_code_active && !qr_code_active && !ble_pairing_active && is_unpaired_locked())
    {
        current_touch_face = FACE_DEAD;
        draw_face_locked(FACE_DEAD);
        ESP_LOGI(TAG, "Unpaired auto-revert: face returned to FACE_DEAD");
    }

    unlock_display();
}
//--------------------------------------------------

[[maybe_unused]] static bool is_six_digit_pairing_code(
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

enum class LcdControllerType {
    UNKNOWN,
    HX8357B,
    HX8357D,
    ILI9486,
    ILI9488,
    ST7796S,
};

static LcdControllerType s_detected_controller = LcdControllerType::UNKNOWN;

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
    esp_rom_delay_us(5);
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_WR, 1));
    esp_rom_delay_us(5);
}

static uint8_t lcd_probe_read8()
{
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RD, 0));
    esp_rom_delay_us(10);

    uint8_t value = 0;
    for(int bit = 0; bit < 8; ++bit)
        value |= (uint8_t)(gpio_get_level(LCD_DATA_PINS[bit]) << bit);

    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RD, 1));
    esp_rom_delay_us(10);
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
    esp_rom_delay_us(15);

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
    vTaskDelay(pdMS_TO_TICKS(150));

    uint8_t reg_0000[4] = {};
    uint8_t reg_04[4] = {};
    uint8_t reg_d3[5] = {};
    uint8_t reg_bf[6] = {};

    lcd_probe_read_register(0x0000, true, reg_0000, sizeof(reg_0000));
    lcd_probe_read_register(0x0004, false, reg_04, sizeof(reg_04));
    lcd_probe_read_register(0x00D3, false, reg_d3, sizeof(reg_d3));
    lcd_probe_read_register(0x00BF, false, reg_bf, sizeof(reg_bf));

    ESP_LOGI(TAG, "=== LCD CONTROLLER DIAGNOSIS ===");
    ESP_LOGI(TAG, "LCD_ID reg0000(16-bit): %02X %02X %02X %02X",
        reg_0000[0], reg_0000[1], reg_0000[2], reg_0000[3]);
    ESP_LOGI(TAG, "LCD_ID reg04(8-bit):    %02X %02X %02X %02X",
        reg_04[0], reg_04[1], reg_04[2], reg_04[3]);
    ESP_LOGI(TAG, "LCD_ID regD3(8-bit):    %02X %02X %02X %02X %02X",
        reg_d3[0], reg_d3[1], reg_d3[2], reg_d3[3], reg_d3[4]);
    ESP_LOGI(TAG, "LCD_ID regBF(8-bit):    %02X %02X %02X %02X %02X %02X",
        reg_bf[0], reg_bf[1], reg_bf[2], reg_bf[3], reg_bf[4], reg_bf[5]);

    if(reg_bf[1] == 0x01 && reg_bf[2] == 0x62 &&
       reg_bf[3] == 0x83 && reg_bf[4] == 0x57)
    {
        s_detected_controller = LcdControllerType::HX8357B;
        ESP_LOGI(TAG, ">> IDENTIFIED: HX8357-B <<");
    }
    else if((reg_d3[2] == 0x83 && reg_d3[3] == 0x57) ||
            (reg_04[2] == 0x80 && reg_04[3] == 0x00))
    {
        s_detected_controller = LcdControllerType::HX8357D;
        ESP_LOGI(TAG, ">> IDENTIFIED: HX8357-D <<");
    }
    else if((reg_d3[2] == 0x94 && reg_d3[3] == 0x86) ||
            (reg_04[2] == 0x94 && reg_04[3] == 0x86))
    {
        s_detected_controller = LcdControllerType::ILI9486;
        ESP_LOGI(TAG, ">> IDENTIFIED: ILI9486 <<");
    }
    else if((reg_d3[2] == 0x94 && reg_d3[3] == 0x88) ||
            (reg_04[2] == 0x54 && reg_04[3] == 0x80))
    {
        s_detected_controller = LcdControllerType::ILI9488;
        ESP_LOGI(TAG, ">> IDENTIFIED: ILI9488 <<");
    }
    else if(reg_04[1] == 0x77 && reg_04[2] == 0x96)
    {
        s_detected_controller = LcdControllerType::ST7796S;
        ESP_LOGI(TAG, ">> IDENTIFIED: ST7796S <<");
    }
    else
    {
        s_detected_controller = LcdControllerType::HX8357B; // default fallback
        ESP_LOGW(TAG, ">> CONTROLLER UNRECOGNIZED: falling back to HX8357-B <<");
    }

    // Put controller back in reset state before I80 takes over
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RST, 0));
    vTaskDelay(pdMS_TO_TICKS(20));
    ESP_ERROR_CHECK(gpio_set_level(LCD_PIN_RST, 1));
    vTaskDelay(pdMS_TO_TICKS(120));
}

static void init_controller_sequence(LcdControllerType type)
{
    if(type == LcdControllerType::HX8357D)
    {
        ESP_LOGI(TAG, "Executing HX8357-D initialization sequence");
        static const uint8_t ext_unlock[] = {0xFF, 0x83, 0x57};
        hx8357_write_command(0xB9, ext_unlock, sizeof(ext_unlock));
        vTaskDelay(pdMS_TO_TICKS(5));

        static const uint8_t set_power[] = {
            0x00, 0x15, 0x1C, 0x1C, 0x83, 0xAA};
        hx8357_write_command(0xB1, set_power, sizeof(set_power));

        static const uint8_t set_display[] = {
            0x02, 0x40, 0x00, 0x2A, 0x2A, 0x0D, 0x78};
        hx8357_write_command(0xB4, set_display, sizeof(set_display));

        static const uint8_t set_vcom[] = {0x50, 0x50};
        hx8357_write_command(0xB6, set_vcom, sizeof(set_vcom));

        static const uint8_t gamma[] = {
            0x02, 0x0A, 0x11, 0x1D, 0x23, 0x35, 0x41, 0x4B, 0x4B, 0x42,
            0x3A, 0x27, 0x1B, 0x08, 0x09, 0x03, 0x02, 0x0A, 0x11, 0x1D,
            0x23, 0x35, 0x41, 0x4B, 0x4B, 0x42, 0x3A, 0x27, 0x1B, 0x08,
            0x09, 0x03, 0x00, 0x01};
        hx8357_write_command(0xE0, gamma, sizeof(gamma));

        hx8357_write_command1(0x3A, 0x55); // RGB565
        hx8357_write_command1(0x36, 0x28); // landscape + BGR
        hx8357_write_command(0x11, NULL, 0); // sleep out
        vTaskDelay(pdMS_TO_TICKS(150));
        hx8357_write_command(0x29, NULL, 0); // display on
        vTaskDelay(pdMS_TO_TICKS(50));
    }
    else if(type == LcdControllerType::ILI9486)
    {
        ESP_LOGI(TAG, "Executing ILI9486 initialization sequence");
        hx8357_write_command(0x11, NULL, 0); // sleep out
        vTaskDelay(pdMS_TO_TICKS(120));

        static const uint8_t pwr1[] = {0x0D, 0x0D};
        hx8357_write_command(0xC0, pwr1, sizeof(pwr1));
        static const uint8_t pwr2[] = {0x43, 0x00};
        hx8357_write_command(0xC1, pwr2, sizeof(pwr2));
        static const uint8_t pwr3[] = {0x00};
        hx8357_write_command(0xC2, pwr3, sizeof(pwr3));
        static const uint8_t vcom[] = {0x00, 0x48, 0x00, 0x48};
        hx8357_write_command(0xC5, vcom, sizeof(vcom));

        hx8357_write_command1(0x36, 0x28); // landscape + BGR
        hx8357_write_command1(0x3A, 0x55); // RGB565
        hx8357_write_command(0x21, NULL, 0); // display inversion on

        vTaskDelay(pdMS_TO_TICKS(120));
        hx8357_write_command(0x29, NULL, 0); // display on
        vTaskDelay(pdMS_TO_TICKS(50));
    }
    else if(type == LcdControllerType::ST7796S)
    {
        ESP_LOGI(TAG, "Executing ST7796S initialization sequence");
        hx8357_write_command(0x11, NULL, 0); // sleep out
        vTaskDelay(pdMS_TO_TICKS(120));

        static const uint8_t cmd_enable[] = {0xC3};
        hx8357_write_command(0xF0, cmd_enable, sizeof(cmd_enable));
        static const uint8_t cmd_enable2[] = {0x96};
        hx8357_write_command(0xF0, cmd_enable2, sizeof(cmd_enable2));

        hx8357_write_command1(0x36, 0x28); // landscape + BGR
        hx8357_write_command1(0x3A, 0x55); // RGB565

        static const uint8_t doca[] = {0x40, 0x8A, 0x00, 0x00, 0x29, 0x19, 0xA5, 0x33};
        hx8357_write_command(0xE8, doca, sizeof(doca));

        static const uint8_t cmd_disable[] = {0x3C};
        hx8357_write_command(0xF0, cmd_disable, sizeof(cmd_disable));
        static const uint8_t cmd_disable2[] = {0x69};
        hx8357_write_command(0xF0, cmd_disable2, sizeof(cmd_disable2));

        hx8357_write_command(0x21, NULL, 0); // display inversion on
        vTaskDelay(pdMS_TO_TICKS(120));
        hx8357_write_command(0x29, NULL, 0); // display on
        vTaskDelay(pdMS_TO_TICKS(50));
    }
    else // Default HX8357-B
    {
        ESP_LOGI(TAG, "Executing HX8357-B initialization sequence (High Contrast & Non-Reversed)");
        static const uint8_t power_control[] = {0x44, 0x41, 0x06};
        static const uint8_t vcom_control[] = {0x40, 0x10};
        static const uint8_t power_normal[] = {0x05, 0x12};
        static const uint8_t panel_driving[] = {0x14, 0x3B, 0x00, 0x02, 0x11};
        static const uint8_t display_frame[] = {0x0C};
        static const uint8_t undefined_ea[] = {0x03, 0x00, 0x00};
        static const uint8_t undefined_eb[] = {0x40, 0x54, 0x26, 0xDB};
        static const uint8_t gamma[] = {
            0x00, 0x15, 0x00, 0x22, 0x00, 0x08,
            0x77, 0x26, 0x66, 0x22, 0x04, 0x00};
        static const uint8_t display_mode[] = {0x00};

        hx8357_write_command(0x11, NULL, 0); // sleep out
        vTaskDelay(pdMS_TO_TICKS(120));
        hx8357_write_command(0xD0, power_control, sizeof(power_control));
        hx8357_write_command(0xD1, vcom_control, sizeof(vcom_control));
        hx8357_write_command(0xD2, power_normal, sizeof(power_normal));
        hx8357_write_command(0xC0, panel_driving, sizeof(panel_driving));
        hx8357_write_command(0xC5, display_frame, sizeof(display_frame));
        hx8357_write_command(0xEA, undefined_ea, sizeof(undefined_ea));
        hx8357_write_command(0xEB, undefined_eb, sizeof(undefined_eb));
        hx8357_write_command(0xC8, gamma, sizeof(gamma));
        hx8357_write_command1(0x36, 0x68); // landscape (MX=1, MV=1, BGR=1): un-reversed left-to-right!
        hx8357_write_command1(0x3A, 0x55); // RGB565 / 16-bit MCU pixels
        hx8357_write_command(0xB2, display_mode, sizeof(display_mode));
        hx8357_write_command(0x20, NULL, 0); // Display Inversion OFF: restores true bright mint green (#b9dfce) from PDF!

        const uint8_t column_address[] = {0x00, 0x00, 0x01, 0xDF};
        const uint8_t page_address[] = {0x00, 0x00, 0x01, 0x3F};
        hx8357_write_command(0x2A, column_address, sizeof(column_address));
        hx8357_write_command(0x2B, page_address, sizeof(page_address));

        vTaskDelay(pdMS_TO_TICKS(120));
        hx8357_write_command(0x29, NULL, 0); // display on
        vTaskDelay(pdMS_TO_TICKS(25));
    }
}

void display_init()
{
    ESP_LOGI(TAG, "Initialize 3.5-inch TFT (i80 8-bit bus, probing controller...)");

    display_mutex =
        xSemaphoreCreateMutex();

    if(display_mutex == NULL)
    {
        ESP_LOGE(TAG, "Display mutex failed");
        return;
    }

    // Step 1: Probe the LCD controller to diagnose true IC
    lcd_probe_controller();

    // Step 2: Configure RD pin HIGH (write mode) before I80 initialization
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

    // Step 3: Initialize Intel 8080 bus
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
    io_config.pclk_hz = LCD_PIXEL_CLOCK_HZ; // 1 MHz for stable signal
    io_config.trans_queue_depth = 4;
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

    // Step 4: Run controller specific initialization sequence
    init_controller_sequence(s_detected_controller);

    // Set address window to full 480x320
    const uint8_t column_address[] = {0x00, 0x00, 0x01, 0xDF};
    const uint8_t page_address[] = {0x00, 0x00, 0x01, 0x3F};
    hx8357_write_command(0x2A, column_address, sizeof(column_address));
    hx8357_write_command(0x2B, page_address, sizeof(page_address));

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

    if(frame_buffer == NULL)
    {
        ESP_LOGE(TAG, "Frame buffer allocation failed");
        return;
    }

    for(size_t i = 0; i < (size_t)LCD_H_RES * LCD_V_RES; ++i) {
        frame_buffer[i] = 0xCF17; // #bae0ce Mint Green
    }

    display_ready = true;
    display_on = true;


    if(unpaired_face_revert_timer == NULL)
    {
        esp_timer_create_args_t timer_args = {};
        timer_args.callback = unpaired_face_revert_timer_cb;
        timer_args.arg = NULL;
        timer_args.name = "unpaired_revert";
        esp_err_t err = esp_timer_create(&timer_args, &unpaired_face_revert_timer);
        if(err != ESP_OK)
        {
            ESP_LOGE(TAG, "Failed to create unpaired revert timer: %s", esp_err_to_name(err));
            unpaired_face_revert_timer = NULL;
        }
    }

    ESP_LOGI(TAG, "Display Ready (480x320 panel, 320x240 frame_buffer)");
    s_face_policy.reset(esp_timer_get_time());
    display_render_asset(s_face_policy.get_current_asset_id());
    xTaskCreateWithCaps(
        display_policy_task,
        "display_policy",
        4096,
        NULL,
        2,
        NULL,
        MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
}

//--------------------------------------------------

void display_sleep()
{
    if(!display_ready)
        return;

    cancel_shy_animation();
    audio_cancelExpressionAudio();
    cancel_unpaired_revert_timer_locked();

    if(!lock_display(pdMS_TO_TICKS(1000)))
        return;

    if(display_on)
    {
        hx8357_write_command(0x28, NULL, 0); // display off
        hx8357_write_command(0x10, NULL, 0); // enter sleep
        display_on = false;
    }
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

    cancel_shy_animation();
    cancel_unpaired_revert_timer_locked();

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
    else if(current_display_mode == DisplayMode::IDLE && ble_pairing_active)
    {
        draw_ble_pairing_overlay_locked();
    }
    else
    {
        draw_face_locked(face);
    }
    unlock_display();
}

void display_set_idle_face(Face face)
{
    if(!display_ready)
    {
        ESP_LOGW(TAG, "Display not ready");
        return;
    }

    cancel_shy_animation();
    cancel_unpaired_revert_timer_locked();

    if(!lock_display(pdMS_TO_TICKS(1000)))
    {
        ESP_LOGW(TAG, "Display busy");
        return;
    }

    current_touch_face = face;
    ble_pairing_active = false;

    if(current_display_mode == DisplayMode::IDLE)
    {
        if(qr_code_active)
            draw_qr_overlay_locked();
        else if(pairing_code_active)
            draw_pairing_overlay_locked();
        else
            draw_face_locked(current_touch_face);
    }
    unlock_display();
    ESP_LOGI(TAG, "Idle face set: face=%s(%d)", face_name(face), (int)face);
}

Face display_next_touch_face()
{
    Face next_face = current_touch_face;

    if(!lock_display(pdMS_TO_TICKS(1000)))
        return next_face;

    cancel_shy_animation();
    cancel_unpaired_revert_timer_locked();

    const Face previous_face = current_touch_face;

    if(is_unpaired_locked())
    {
        const int next_face_index = s_unpaired_cycle_index % static_cast<int>(FACE_DEAD);
        s_unpaired_cycle_index = (next_face_index + 1) % static_cast<int>(FACE_DEAD);
        current_touch_face = static_cast<Face>(next_face_index);
        next_face = current_touch_face;

        if(display_ready && current_display_mode == DisplayMode::IDLE)
        {
            if(qr_code_active)
                draw_qr_overlay_locked();
            else if(pairing_code_active)
                draw_pairing_overlay_locked();
            else if(ble_pairing_active)
                draw_ble_pairing_overlay_locked();
            else
                draw_face_locked(current_touch_face);
        }

        schedule_unpaired_revert_timer_locked();
    }
    else
    {
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
            else if(ble_pairing_active)
                draw_ble_pairing_overlay_locked();
            else
                draw_face_locked(current_touch_face);
        }
    }

    ESP_LOGI(
        TAG,
        "Idle face advance: before=%s(%d) after=%s(%d) render_requested=%d mode=%s unpaired=%d",
        face_name(previous_face),
        (int)previous_face,
        face_name(current_touch_face),
        (int)current_touch_face,
        display_ready && current_display_mode == DisplayMode::IDLE ? 1 : 0,
        display_mode_name(current_display_mode),
        is_unpaired_locked() ? 1 : 0);

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

bool display_start_shy()
{
    display_trigger_touch_overlay();
    return true;
}

void display_cancel_shy()
{
}

bool display_is_shy_active()
{
    return s_face_policy.get_current_mode() == FaceMode::IDLE_OVERLAY;
}

bool display_is_unpaired_revert_active()
{
    if(!lock_display(pdMS_TO_TICKS(500)))
        return unpaired_revert_active;
    bool active = unpaired_revert_active;
    unlock_display();
    return active;
}

void display_cancel_unpaired_revert()
{
    if(!lock_display(pdMS_TO_TICKS(500)))
        return;
    cancel_unpaired_revert_timer_locked();
    unlock_display();
}

void display_trigger_unpaired_revert()
{
    if(!lock_display(pdMS_TO_TICKS(500)))
        return;
    cancel_unpaired_revert_timer_locked();
    if(display_ready && current_display_mode == DisplayMode::IDLE &&
       !pairing_code_active && !qr_code_active && !ble_pairing_active && is_unpaired_locked())
    {
        current_touch_face = FACE_DEAD;
        draw_face_locked(FACE_DEAD);
        ESP_LOGI(TAG, "Unpaired revert triggered: face returned to FACE_DEAD");
    }
    unlock_display();
}

void display_set_mode(DisplayMode mode)
{
    if(mode != DisplayMode::IDLE)
    {
        cancel_shy_animation();
        audio_cancelExpressionAudio();
        cancel_unpaired_revert_timer_locked();
        ble_pairing_active = false;
        ble_pairing_remaining_sec = 0;
    }

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

    if(mode == DisplayMode::IDLE && ble_pairing_active)
    {
        draw_ble_pairing_overlay_locked();
        unlock_display();
        return;
    }
    switch(mode)
    {
        case DisplayMode::IDLE:
            s_face_policy.trigger_speaking_stop(esp_timer_get_time());
            break;
        case DisplayMode::LISTENING:
            s_face_policy.trigger_recording_start(esp_timer_get_time());
            break;
        case DisplayMode::THINKING:
            s_face_policy.trigger_thinking_start(esp_timer_get_time());
            break;
        case DisplayMode::SPEAKING:
            s_face_policy.trigger_speaking_start(esp_timer_get_time());
            break;
        case DisplayMode::ERROR:
            s_face_policy.trigger_error(esp_timer_get_time());
            break;
    }
    unlock_display();
}

bool display_set_pairing_code(
    const char code[7],
    time_t expires_at_epoch)
{
    // Legacy pairing code overlay disabled: pairing is managed via BLE Scheme 2
    return true;
}

void display_update_pairing_countdown()
{
    // Legacy countdown overlay disabled
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
    return false;
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

    cancel_shy_animation();
    audio_cancelExpressionAudio();

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

bool display_show_ble_pairing(int remaining_seconds)
{
    cancel_shy_animation();
    cancel_unpaired_revert_timer_locked();

    if(!lock_display(pdMS_TO_TICKS(1000)))
        return false;

    current_display_mode = DisplayMode::IDLE;
    ble_pairing_active = true;
    ble_pairing_remaining_sec = remaining_seconds;

    if(display_ready)
        draw_ble_pairing_overlay_locked();
    unlock_display();
    return true;
}

void display_update_ble_countdown(int remaining_seconds)
{
    // Timer display disabled per user request
    ble_pairing_remaining_sec = remaining_seconds;
}

void display_hide_ble_pairing()
{
    if(!lock_display(pdMS_TO_TICKS(1000)))
        return;

    if(!ble_pairing_active)
    {
        unlock_display();
        return;
    }

    ble_pairing_active = false;
    ble_pairing_remaining_sec = 0;

    const bool redraw_idle_face =
        display_ready && current_display_mode == DisplayMode::IDLE;

    if(redraw_idle_face)
    {
        if(qr_code_active)
            draw_qr_overlay_locked();
        else if(pairing_code_active)
            draw_pairing_overlay_locked();
        else
            draw_face_locked(current_touch_face);
    }

    unlock_display();
}

bool display_ble_pairing_is_visible()
{
    if(!lock_display(pdMS_TO_TICKS(100)))
        return false;

    const bool visible =
        display_ready &&
        display_on &&
        ble_pairing_active &&
        current_display_mode == DisplayMode::IDLE;
    unlock_display();
    return visible;
}
void display_trigger_touch_overlay() {
    s_face_policy.trigger_touch_overlay(esp_timer_get_time());
}

void display_trigger_expression_overlay() {
    s_face_policy.trigger_expression_overlay(esp_timer_get_time());
}

void display_trigger_expression_test(int expression_index) {
    if (expression_index < 0 || expression_index >= 10) return;
    Face face = static_cast<Face>(expression_index);
    uint8_t asset_id = face_to_v2_asset_id(face);

    ESP_LOGI(TAG, ">>> [EXPRESSION TEST] Index %d (%s) -> Asset %d <<<",
             expression_index, face_name(face), asset_id);

    s_face_policy.trigger_custom_overlay(esp_timer_get_time(), asset_id);
    display_render_asset(asset_id);
    audio_triggerExpressionAudio(expression_index);
}

void display_trigger_ble_discovery() {
    s_face_policy.trigger_ble_discovery_start(esp_timer_get_time());
}

void display_trigger_ble_connected() {
    s_face_policy.trigger_ble_connected(esp_timer_get_time());
}

void display_trigger_ble_proof_accepted() {
    s_face_policy.trigger_ble_proof_accepted(esp_timer_get_time());
}

void display_trigger_provisioning_success() {
    s_face_policy.trigger_provisioning_success(esp_timer_get_time());
}

void display_trigger_ble_stop() {
    s_face_policy.trigger_ble_stop(esp_timer_get_time());
}
