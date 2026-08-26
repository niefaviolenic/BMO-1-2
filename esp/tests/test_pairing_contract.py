import re
import unittest
from pathlib import Path


ESP_ROOT = Path(__file__).resolve().parents[1]
PAIRING_HEADER = ESP_ROOT / "main" / "pairing.h"
PAIRING_SOURCE = ESP_ROOT / "main" / "pairing.cpp"
API_SOURCE = ESP_ROOT / "main" / "api.cpp"
DISPLAY_HEADER = ESP_ROOT / "main" / "display.h"
DISPLAY_SOURCE = ESP_ROOT / "main" / "display.cpp"
STATE_SOURCE = ESP_ROOT / "main" / "state.cpp"
MAIN_CMAKE = ESP_ROOT / "main" / "CMakeLists.txt"


def function_body(source: str, signature: str) -> str:
    match = re.search(signature + r"\s*\{", source)
    if match is None:
        raise AssertionError(f"function not found: {signature}")

    depth = 1
    index = match.end()
    body_start = index
    while index < len(source) and depth:
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
        index += 1

    if depth:
        raise AssertionError(f"function closing brace not found: {signature}")
    return source[body_start : index - 1]


class PairingControllerTest(unittest.TestCase):
    def read_required(self, path: Path) -> str:
        self.assertTrue(path.exists(), f"required Patch 1 file is missing: {path.name}")
        return path.read_text(encoding="utf-8")

    def test_controller_is_registered(self) -> None:
        cmake = self.read_required(MAIN_CMAKE)

        self.assertRegex(cmake, r'idf_component_register\s*\([^)]*"pairing\.cpp"')

    def test_public_state_machine_types_match_patch_1_design(self) -> None:
        header = self.read_required(PAIRING_HEADER)

        phase_body = re.search(
            r"enum\s+class\s+PairingPhase\s*:\s*uint8_t\s*\{(?P<body>.*?)\};",
            header,
            re.DOTALL,
        )
        self.assertIsNotNone(phase_body, "PairingPhase enum is missing")
        phases = re.findall(r"\b[A-Z][A-Z0-9_]*\b", phase_body.group("body"))
        self.assertEqual(
            phases,
            [
                "NONE",
                "CODE_ACTIVE",
                "CODE_EXPIRED",
                "RECOVERY_WAIT",
                "RECOVERY_SENT",
                "RECONNECT_PENDING",
            ],
        )

        for action in (
            "PAIRING_ACTION_NONE",
            "PAIRING_ACTION_SHOW_UI",
            "PAIRING_ACTION_CLEAR_UI",
            "PAIRING_ACTION_SEND_REQUEST",
            "PAIRING_ACTION_RECONNECT",
        ):
            self.assertIn(action, header)

        for field in (
            "char code[7]",
            "time_t expires_at_epoch",
            "int64_t last_request_ms",
            "int64_t recovery_due_ms",
            "uint32_t socket_generation",
            "bool pairing_seen_in_boot",
            "bool incomplete_before_disconnect",
            "bool request_sent_this_reason",
        ):
            self.assertIn(field, header)

    def test_controller_exposes_events_and_action_polling_only(self) -> None:
        header = self.read_required(PAIRING_HEADER)

        for function in (
            "pairing_init",
            "pairing_on_socket_connected",
            "pairing_on_authenticated",
            "pairing_on_disconnected",
            "pairing_on_code",
            "pairing_on_completed",
            "pairing_poll",
            "pairing_get_snapshot",
        ):
            self.assertIn(function, header)

        forbidden_dependencies = (
            "api.h",
            "display.h",
            "wifi.h",
            "audio.h",
            "bmo_credentials.h",
            "BMO_DEVICE_TOKEN",
            "esp_websocket_client",
        )
        for dependency in forbidden_dependencies:
            self.assertNotIn(dependency, header)

    def test_code_and_expiry_validation_are_strict_and_ram_only(self) -> None:
        source = self.read_required(PAIRING_SOURCE)

        self.assertIn("is_six_digit_code", source)
        self.assertIn("parse_rfc3339_utc", source)
        self.assertIn("days_in_month", source)
        self.assertIn("secure_clear_code_locked", source)
        self.assertRegex(source, r"expires_at_epoch\s*<=\s*now_epoch")

        for forbidden_operation in (
            "nvs_",
            "fopen",
            "fprintf",
            "ESP_LOG",
            "printf(",
            "BMO_DEVICE_TOKEN",
        ):
            self.assertNotIn(forbidden_operation, source)

    def test_pairing_code_validation_accepts_only_six_numeric_digits(self) -> None:
        source = self.read_required(PAIRING_SOURCE)
        validator = function_body(
            source,
            r"bool\s+is_six_digit_code\s*\([^)]*\)",
        )

        self.assertIn("strlen(code) != 6", validator)
        self.assertIn("is_ascii_digit(code[index])", validator)

        digit_validator = function_body(
            source,
            r"bool\s+is_ascii_digit\s*\([^)]*\)",
        )
        self.assertRegex(digit_validator, r"value\s*>=\s*'0'")
        self.assertRegex(digit_validator, r"value\s*<=\s*'9'")

    def test_pairing_code_is_stored_and_consumed_in_backend_order(self) -> None:
        source = self.read_required(PAIRING_SOURCE)
        code_handler = function_body(
            source,
            r"bool\s+pairing_on_code\s*\([^)]*\)",
        )

        self.assertIn("std::memcpy(s_controller.snapshot.code, code, 6)", code_handler)
        self.assertNotRegex(code_handler, r"reverse|strrev|code\[5\s*-\s*index\]")

    def test_all_state_transitions_and_firmware_timers_are_implemented(self) -> None:
        source = self.read_required(PAIRING_SOURCE)

        # These durations are firmware policy, not Backend protocol requirements.
        self.assertRegex(source, r"kRecoveryGraceMs\s*=\s*2000")
        self.assertRegex(source, r"kRequestDebounceMs\s*=\s*5000")

        for phase in (
            "PairingPhase::NONE",
            "PairingPhase::CODE_ACTIVE",
            "PairingPhase::CODE_EXPIRED",
            "PairingPhase::RECOVERY_WAIT",
            "PairingPhase::RECOVERY_SENT",
            "PairingPhase::RECONNECT_PENDING",
        ):
            self.assertIn(phase, source)

        for action in (
            "PAIRING_ACTION_SHOW_UI",
            "PAIRING_ACTION_CLEAR_UI",
            "PAIRING_ACTION_SEND_REQUEST",
            "PAIRING_ACTION_RECONNECT",
        ):
            self.assertIn(action, source)

        self.assertIn("request_pending", source)
        self.assertIn("request_is_recovery", source)
        self.assertIn("incomplete_before_disconnect", source)


class PairingDisplayOverlayTest(unittest.TestCase):
    def read_required(self, path: Path) -> str:
        self.assertTrue(path.exists(), f"required Patch 2 file is missing: {path.name}")
        return path.read_text(encoding="utf-8")

    def read_integer_constant(self, source: str, name: str) -> int:
        match = re.search(
            rf"static\s+constexpr\s+int\s+{name}\s*=\s*(\d+)\s*;",
            source,
        )
        self.assertIsNotNone(match, f"integer constant is missing: {name}")
        return int(match.group(1))

    def read_pairing_glyphs(self, source: str) -> tuple[tuple[int, ...], ...]:
        match = re.search(
            r"PAIRING_NUMERIC_GLYPHS\s*\[\s*10\s*\]\s*"
            r"\[\s*PAIRING_GLYPH_ROWS\s*\]\s*=\s*\{(?P<body>.*?)\};",
            source,
            re.DOTALL,
        )
        self.assertIsNotNone(match, "pairing glyph table is missing")
        rows = re.findall(r"\{([^{}]*)\}", match.group("body"))
        self.assertEqual(len(rows), 10, "pairing glyph table must contain ten digits")

        return tuple(
            tuple(int(value, 0) for value in re.findall(r"0[xX][0-9A-Fa-f]+|\d+", row))
            for row in rows
        )

    def expected_pairing_glyphs(self) -> tuple[tuple[str, ...], ...]:
        return (
            ("01110", "10001", "10011", "10101", "11001", "10001", "01110"),
            ("00100", "01100", "00100", "00100", "00100", "00100", "01110"),
            ("01110", "10001", "00001", "00010", "00100", "01000", "11111"),
            ("11110", "00001", "00001", "01110", "00001", "00001", "11110"),
            ("00010", "00110", "01010", "10010", "11111", "00010", "00010"),
            ("11111", "10000", "10000", "11110", "00001", "00001", "11110"),
            ("00110", "01000", "10000", "11110", "10001", "10001", "01110"),
            ("11111", "00001", "00010", "00100", "01000", "01000", "01000"),
            ("01110", "10001", "10001", "01110", "10001", "10001", "01110"),
            ("01110", "10001", "10001", "01111", "00001", "00010", "01100"),
        )

    def rasterize_pairing_glyph(
        self,
        glyph: tuple[int, ...],
        columns: int,
        scale_x: int,
        scale_y: int,
    ) -> tuple[str, ...]:
        matrix: list[str] = []
        for bits in glyph:
            row = "".join(
                ("#" if (bits & (1 << (columns - 1 - column))) != 0 else ".") * scale_x
                for column in range(columns)
            )
            matrix.extend([row] * scale_y)
        return tuple(matrix)

    def test_display_exposes_pairing_overlay_api(self) -> None:
        header = self.read_required(DISPLAY_HEADER)

        self.assertRegex(
            header,
            r"bool\s+display_set_pairing_code\s*\(\s*const\s+char\s+code\s*\[\s*7\s*\]\s*\)\s*;",
        )
        self.assertRegex(header, r"void\s+display_clear_pairing_code\s*\(\s*\)\s*;")
        self.assertRegex(header, r"bool\s+display_pairing_code_is_visible\s*\(\s*\)\s*;")

    def test_overlay_has_fixed_six_digit_bounded_renderer(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)

        self.assertIn("pairing_code[7]", source)
        self.assertIn("pairing_code_active", source)
        self.assertRegex(source, r"PAIRING_NUMERIC_GLYPHS\s*\[\s*10\s*\]")
        self.assertIn("draw_pairing_digit", source)
        self.assertIn("draw_pairing_overlay_locked", source)
        self.assertRegex(source, r"for\s*\([^;]*;[^;]*<\s*6\s*;")
        self.assertIn("PAIRING_TOTAL_WIDTH", source)
        self.assertRegex(source, r"static_assert\s*\([^;]*LCD_H_RES")
        self.assertRegex(source, r"static_assert\s*\([^;]*LCD_V_RES")

    def test_pairing_renderer_uses_conventional_numeric_glyphs(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)

        for forbidden in (
            "SEGMENT_A",
            "SEGMENT_B",
            "SEGMENT_C",
            "SEGMENT_D",
            "SEGMENT_E",
            "SEGMENT_F",
            "SEGMENT_G",
            "DIGIT_SEGMENTS",
            "PAIRING_SEGMENT_THICKNESS",
            "pairing_fill_physical_rect",
            "pairing_fill_user_rect",
        ):
            self.assertNotIn(forbidden, source)

        digit = function_body(
            source,
            r"static\s+void\s+draw_pairing_digit\s*\([^)]*\)",
        )
        self.assertIn("PAIRING_NUMERIC_GLYPHS", digit)
        self.assertIn("pairing_fill_x_mirrored_rect", digit)

    def test_pairing_glyph_table_matches_exact_upright_logical_matrices(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        columns = self.read_integer_constant(source, "PAIRING_GLYPH_COLUMNS")
        rows = self.read_integer_constant(source, "PAIRING_GLYPH_ROWS")
        self.assertEqual(columns, 5)
        self.assertEqual(rows, 7)

        actual = self.read_pairing_glyphs(source)
        expected = self.expected_pairing_glyphs()
        self.assertEqual(
            tuple(
                tuple(format(value, f"0{columns}b") for value in glyph)
                for glyph in actual
            ),
            expected,
        )

    def test_pairing_sequence_123564_has_exact_pre_transform_matrices(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        columns = self.read_integer_constant(source, "PAIRING_GLYPH_COLUMNS")
        glyphs = self.read_pairing_glyphs(source)
        expected = self.expected_pairing_glyphs()

        actual_sequence = tuple(
            tuple(format(value, f"0{columns}b") for value in glyphs[int(digit)])
            for digit in "123564"
        )
        expected_sequence = tuple(expected[int(digit)] for digit in "123564")
        self.assertEqual(actual_sequence, expected_sequence)

    def test_pairing_raster_matrices_are_exact_for_all_digits_and_123564(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        columns = self.read_integer_constant(source, "PAIRING_GLYPH_COLUMNS")
        scale_x = self.read_integer_constant(source, "PAIRING_GLYPH_SCALE_X")
        scale_y = self.read_integer_constant(source, "PAIRING_GLYPH_SCALE_Y")
        actual_glyphs = self.read_pairing_glyphs(source)
        expected_glyphs = tuple(
            tuple(int(row, 2) for row in glyph)
            for glyph in self.expected_pairing_glyphs()
        )

        actual_matrices = tuple(
            self.rasterize_pairing_glyph(glyph, columns, scale_x, scale_y)
            for glyph in actual_glyphs
        )
        expected_matrices = tuple(
            self.rasterize_pairing_glyph(glyph, columns, scale_x, scale_y)
            for glyph in expected_glyphs
        )

        self.assertEqual(actual_matrices, expected_matrices)
        for matrix in actual_matrices:
            self.assertEqual(len(matrix), 63)
            self.assertTrue(all(len(row) == 35 for row in matrix))

        self.assertEqual(
            tuple(actual_matrices[int(digit)] for digit in "123564"),
            tuple(expected_matrices[int(digit)] for digit in "123564"),
        )

    def test_pairing_rasterization_preserves_matrix_row_column_order_and_scale(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        columns = self.read_integer_constant(source, "PAIRING_GLYPH_COLUMNS")
        rows = self.read_integer_constant(source, "PAIRING_GLYPH_ROWS")
        scale_x = self.read_integer_constant(source, "PAIRING_GLYPH_SCALE_X")
        scale_y = self.read_integer_constant(source, "PAIRING_GLYPH_SCALE_Y")
        digit_width = self.read_integer_constant(source, "PAIRING_DIGIT_WIDTH")
        digit_height = self.read_integer_constant(source, "PAIRING_DIGIT_HEIGHT")

        self.assertEqual(digit_width, columns * scale_x)
        self.assertEqual(digit_height, rows * scale_y)

        digit = function_body(
            source,
            r"static\s+void\s+draw_pairing_digit\s*\([^)]*\)",
        )
        self.assertRegex(digit, r"for\s*\(int\s+row\s*=\s*0\s*;\s*row\s*<\s*PAIRING_GLYPH_ROWS")
        self.assertRegex(digit, r"for\s*\(int\s+column\s*=\s*0\s*;\s*column\s*<\s*PAIRING_GLYPH_COLUMNS")
        self.assertIn(
            "1U << (PAIRING_GLYPH_COLUMNS - 1 - column)",
            digit,
        )
        self.assertIn("x + column * PAIRING_GLYPH_SCALE_X", digit)
        self.assertIn("y + row * PAIRING_GLYPH_SCALE_Y", digit)
        self.assertIn("PAIRING_GLYPH_SCALE_X", digit)
        self.assertIn("PAIRING_GLYPH_SCALE_Y", digit)

    def test_pairing_digits_have_readable_aspect_ratio(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        digit_width = self.read_integer_constant(source, "PAIRING_DIGIT_WIDTH")
        digit_height = self.read_integer_constant(source, "PAIRING_DIGIT_HEIGHT")

        self.assertGreaterEqual(
            digit_width * 100,
            digit_height * 45,
            "pairing digits are too narrow for reliable numeric recognition",
        )

    def test_pairing_digit_gap_is_clear(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        digit_gap = self.read_integer_constant(source, "PAIRING_DIGIT_GAP")

        self.assertGreaterEqual(digit_gap, 5, "adjacent pairing digits are visually crowded")

    def test_pairing_digits_are_large_enough_for_physical_readability(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        digit_width = self.read_integer_constant(source, "PAIRING_DIGIT_WIDTH")
        digit_height = self.read_integer_constant(source, "PAIRING_DIGIT_HEIGHT")

        self.assertGreaterEqual(
            digit_width,
            32,
            "pairing glyph width is too small for physical reading",
        )
        self.assertGreaterEqual(
            digit_height,
            56,
            "pairing glyph height is too small for physical reading",
        )

    def test_pairing_renderer_keeps_the_existing_panel_transform(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)

        self.assertRegex(source, r"#define\s+LCD_H_RES\s+320\b")
        self.assertRegex(source, r"#define\s+LCD_V_RES\s+240\b")
        self.assertRegex(source, r"#define\s+LCD_SWAP_XY\s+true\b")
        self.assertRegex(source, r"#define\s+LCD_MIRROR_X\s+true\b")
        self.assertRegex(source, r"#define\s+LCD_MIRROR_Y\s+false\b")

    def test_pairing_renderer_uses_x_only_panel_mapping(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        mapper = function_body(
            source,
            r"static\s+void\s+pairing_fill_x_mirrored_rect\s*\([^)]*\)",
        )
        digit = function_body(
            source,
            r"static\s+void\s+draw_pairing_digit\s*\([^)]*\)",
        )

        self.assertIn("LCD_H_RES - x - width", mapper)
        self.assertIn("compensated_x", mapper)
        self.assertRegex(
            mapper,
            r"fill_rect\s*\(\s*compensated_x\s*,\s*compensated_y\s*,\s*width\s*,\s*height\s*,\s*color\s*\)",
        )
        self.assertNotIn("LCD_V_RES", mapper)
        self.assertNotIn("swap", mapper.lower())
        self.assertIn("pairing_fill_x_mirrored_rect", digit)
        self.assertNotRegex(digit, r"(?<!pairing_)fill_rect\s*\(")

    def test_pairing_panel_mapping_preserves_y_and_mirrors_only_x(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        mapper = function_body(
            source,
            r"static\s+void\s+pairing_fill_x_mirrored_rect\s*\([^)]*\)",
        )

        self.assertRegex(mapper, r"const\s+int\s+compensated_x\s*=\s*LCD_H_RES\s*-\s*x\s*-\s*width")
        self.assertRegex(mapper, r"const\s+int\s+compensated_y\s*=\s*y")
        self.assertRegex(
            mapper,
            r"fill_rect\s*\(\s*compensated_x\s*,\s*compensated_y\s*,\s*width\s*,\s*height\s*,\s*color\s*\)",
        )

        def map_rect(x: int, y: int, width: int, height: int) -> tuple[int, int, int, int]:
            return (320 - x - width, y, width, height)

        self.assertEqual(map_rect(37, 88, 7, 9), (276, 88, 7, 9))
        self.assertEqual(map_rect(247, 88, 7, 9), (66, 88, 7, 9))
        self.assertEqual(map_rect(100, 120, 35, 63), (185, 120, 35, 63))

    def test_pairing_code_is_a_single_user_horizontal_row_inside_the_face(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        digit_width = self.read_integer_constant(source, "PAIRING_DIGIT_WIDTH")
        digit_gap = self.read_integer_constant(source, "PAIRING_DIGIT_GAP")
        total_width = 6 * digit_width + 5 * digit_gap

        self.assertLessEqual(
            total_width,
            320 - 64,
            "pairing row does not fit inside the user-horizontal face axis",
        )
        self.assertRegex(
            source,
            r"PAIRING_START_X\s*=\s*\(LCD_H_RES\s*-\s*PAIRING_TOTAL_WIDTH\)\s*/\s*2",
        )
        self.assertRegex(
            source,
            r"PAIRING_START_Y\s*=\s*\(LCD_V_RES\s*-\s*PAIRING_DIGIT_HEIGHT\)\s*/\s*2",
        )

    def test_pairing_row_follows_the_observed_physical_horizontal_axis(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        digit_width = self.read_integer_constant(source, "PAIRING_DIGIT_WIDTH")
        digit_height = self.read_integer_constant(source, "PAIRING_DIGIT_HEIGHT")
        digit_gap = self.read_integer_constant(source, "PAIRING_DIGIT_GAP")
        total_width = 6 * digit_width + 5 * digit_gap

        self.assertLessEqual(
            total_width,
            320 - 64,
            "pairing row must fit across the observed user-horizontal axis",
        )
        self.assertLessEqual(
            digit_height,
            240 - 64,
            "pairing glyph must fit across the observed user-vertical axis",
        )
        self.assertRegex(
            source,
            r"PAIRING_START_X\s*=\s*\(LCD_H_RES\s*-\s*PAIRING_TOTAL_WIDTH\)\s*/\s*2",
        )
        self.assertRegex(
            source,
            r"PAIRING_START_Y\s*=\s*\(LCD_V_RES\s*-\s*PAIRING_DIGIT_HEIGHT\)\s*/\s*2",
        )

        overlay = function_body(
            source,
            r"static\s+void\s+draw_pairing_overlay_locked\s*\([^)]*\)",
        )
        self.assertRegex(
            overlay,
            r"PAIRING_START_X\s*\+\s*index\s*\*\s*\(PAIRING_DIGIT_WIDTH\s*\+\s*PAIRING_DIGIT_GAP\)",
        )
        self.assertIn("PAIRING_START_Y", overlay)

    def test_pairing_overlay_iterates_code_left_to_right_without_reordering(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        overlay = function_body(
            source,
            r"static\s+void\s+draw_pairing_overlay_locked\s*\([^)]*\)",
        )

        self.assertRegex(
            overlay,
            r"for\s*\(\s*int\s+index\s*=\s*0\s*;\s*index\s*<\s*6\s*;\s*\+\+index\s*\)",
        )
        self.assertRegex(
            overlay,
            r"draw_pairing_digit\s*\(\s*x\s*,\s*PAIRING_START_Y\s*,\s*"
            r"static_cast<uint8_t>\(pairing_code\[index\]\s*-\s*'0'\)\s*\)",
        )

    def test_set_replace_clear_paths_are_locked_and_clear_local_buffer(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        set_body = function_body(source, r"bool\s+display_set_pairing_code\s*\([^)]*\)")
        clear_body = function_body(source, r"void\s+display_clear_pairing_code\s*\([^)]*\)")
        visible_body = function_body(source, r"bool\s+display_pairing_code_is_visible\s*\([^)]*\)")

        self.assertIn("is_six_digit_pairing_code", set_body)
        self.assertIn("secure_clear_pairing_code_locked", set_body)
        self.assertIn("pairing_code_active = true", set_body)
        self.assertIn("draw_pairing_overlay_locked", set_body)
        self.assertRegex(
            set_body,
            r"if\s*\(\s*pairing_code_active\s*&&\s*memcmp\s*\(",
        )
        self.assertIn("secure_clear_pairing_code_locked", clear_body)
        self.assertIn("pairing_code_active = false", clear_body)
        self.assertRegex(clear_body, r"if\s*\(\s*!pairing_code_active\s*\)")

        for body in (set_body, clear_body, visible_body):
            self.assertIn("lock_display", body)
            self.assertIn("unlock_display", body)

    def test_voice_modes_override_overlay_and_idle_restores_it(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        set_mode_body = function_body(source, r"void\s+display_set_mode\s*\([^)]*\)")
        face_body = function_body(source, r"void\s+display_face\s*\([^)]*\)")

        self.assertIn("current_display_mode = mode", set_mode_body)
        self.assertRegex(
            set_mode_body,
            r"mode\s*==\s*DisplayMode::IDLE\s*&&\s*pairing_code_active",
        )
        self.assertIn("draw_pairing_overlay_locked", set_mode_body)
        for mode in ("THINKING", "SPEAKING", "ERROR"):
            self.assertIn(f"DisplayMode::{mode}", set_mode_body)
        self.assertRegex(
            set_mode_body,
            r"case\s+DisplayMode::THINKING\s*:\s*draw_face_locked\s*\(\s*FACE_CONFUSED\s*\)",
        )
        self.assertRegex(
            set_mode_body,
            r"case\s+DisplayMode::SPEAKING\s*:\s*draw_face_locked\s*\(\s*FACE_HAPPY\s*\)",
        )
        self.assertRegex(
            set_mode_body,
            r"case\s+DisplayMode::ERROR\s*:\s*draw_face_locked\s*\(\s*FACE_SAD\s*\)",
        )

        self.assertRegex(
            face_body,
            r"current_display_mode\s*==\s*DisplayMode::IDLE\s*&&\s*pairing_code_active",
        )
        self.assertIn("draw_pairing_overlay_locked", face_body)

    def test_pairing_render_path_never_logs_code_or_adds_delay(self) -> None:
        source = self.read_required(DISPLAY_SOURCE)
        pairing_functions = (
            r"static\s+void\s+draw_pairing_digit\s*\([^)]*\)",
            r"static\s+void\s+draw_pairing_overlay_locked\s*\([^)]*\)",
            r"bool\s+display_set_pairing_code\s*\([^)]*\)",
            r"void\s+display_clear_pairing_code\s*\([^)]*\)",
            r"bool\s+display_pairing_code_is_visible\s*\([^)]*\)",
        )

        for signature in pairing_functions:
            body = function_body(source, signature)
            self.assertNotIn("ESP_LOG", body)
            self.assertNotIn("printf(", body)
            self.assertNotIn("vTaskDelay", body)
            self.assertNotIn("malloc", body)

    def test_recording_releases_local_listening_before_upload(self) -> None:
        source = self.read_required(STATE_SOURCE)
        task = function_body(
            source,
            r"static\s+void\s+bmo_state_machine_task\s*\([^)]*\)",
        )
        recording_case = re.search(
            r"case\s+BMOState::RECORDING\s*:(?P<body>.*?)case\s+BMOState::THINKING\s*:",
            task,
            re.DOTALL,
        )

        self.assertIsNotNone(recording_case, "RECORDING display branch not found")
        body = recording_case.group("body")
        self.assertTrue(
            "setState(BMOState::THINKING)" in body or "display_set_mode(DisplayMode::IDLE)" in body,
            "RECORDING completion must release LISTENING before upload",
        )
        if "setState(BMOState::THINKING)" in body:
            thinking = body.index("setState(BMOState::THINKING)")
            upload = body.index("api_upload_audio_and_process()")
            self.assertLess(thinking, upload)

class PairingWebSocketIntegrationTest(unittest.TestCase):
    def read_api(self) -> str:
        self.assertTrue(API_SOURCE.exists(), "api.cpp is missing")
        return API_SOURCE.read_text(encoding="utf-8")

    def event_branch(self, source: str, event: str, next_marker: str) -> str:
        marker = f'else if (strcmp(event, "{event}") == 0)'
        start = source.find(marker)
        self.assertNotEqual(start, -1, f"{event} dispatch is missing")
        end = source.find(next_marker, start + len(marker))
        self.assertNotEqual(end, -1, f"end marker for {event} dispatch is missing")
        return source[start:end]

    def test_pairing_code_dispatch_is_authenticated_strict_and_controller_owned(self) -> None:
        source = self.read_api()
        auth_guard = source.find("else if (!ws_authenticated)")
        pairing_dispatch = source.find('else if (strcmp(event, "pairing_code") == 0)')

        self.assertGreater(pairing_dispatch, auth_guard)
        branch = self.event_branch(
            source,
            "pairing_code",
            'else if (strcmp(event, "pairing_completed") == 0)',
        )
        self.assertIn("PAIRING_CODE_FIELDS", branch)
        self.assertIn('cJSON_GetObjectItem(root, "code")', branch)
        self.assertIn('cJSON_GetObjectItem(root, "expires_at")', branch)
        self.assertIn("pairing_on_code", branch)
        for forbidden_side_effect in (
            "display_set_pairing_code",
            "display_clear_pairing_code",
            "stop_ws_if_started",
            "start_ws_if_network_ready",
            "vTaskDelay",
        ):
            self.assertNotIn(forbidden_side_effect, branch)
        self.assertNotRegex(branch, r"ESP_LOG[A-Z]*\s*\([^;]*code_node")

    def test_pairing_completed_dispatch_accepts_only_exact_ok_event(self) -> None:
        source = self.read_api()
        branch = self.event_branch(
            source,
            "pairing_completed",
            'else if (strcmp(event, "display_status") == 0)',
        )

        self.assertIn("PAIRING_COMPLETED_FIELDS", branch)
        self.assertIn('cJSON_GetObjectItem(root, "status")', branch)
        self.assertIn('strcmp(status_node->valuestring, "ok") == 0', branch)
        self.assertIn("pairing_on_completed();", branch)
        for forbidden_side_effect in (
            "display_clear_pairing_code",
            "stop_ws_if_started",
            "start_ws_if_network_ready",
            "PAIRING_ACTION_RECONNECT",
            "vTaskDelay",
        ):
            self.assertNotIn(forbidden_side_effect, branch)

    def test_pairing_mode_request_sender_has_only_event_field(self) -> None:
        source = self.read_api()
        sender = function_body(source, r"static\s+bool\s+send_pairing_mode_request\s*\([^)]*\)")

        self.assertEqual(sender.count("cJSON_AddStringToObject"), 1)
        self.assertIn(
            'cJSON_AddStringToObject(root, "event", "pairing_mode_request")',
            sender,
        )
        self.assertIn("ws_send_text(json_str, true)", sender)
        for forbidden in (
            "BMO_DEVICE_ID",
            "BMO_DEVICE_TOKEN",
            '"device_id"',
            '"device_token"',
            '"request_id"',
            '"code"',
            '"hardware_id"',
        ):
            self.assertNotIn(forbidden, sender)

    def test_pairing_actions_own_display_send_and_reconnect_side_effects(self) -> None:
        source = self.read_api()
        processor = function_body(source, r"static\s+void\s+process_pairing_actions\s*\([^)]*\)")

        self.assertIn("pairing_poll", processor)
        self.assertIn("PAIRING_ACTION_SHOW_UI", processor)
        self.assertIn("display_set_pairing_code", processor)
        self.assertIn("PAIRING_ACTION_CLEAR_UI", processor)
        self.assertIn("display_clear_pairing_code", processor)
        self.assertIn("PAIRING_ACTION_SEND_REQUEST", processor)
        self.assertIn("send_pairing_mode_request", processor)
        self.assertIn("PAIRING_ACTION_RECONNECT", processor)
        self.assertIn("ws_pairing_reconnect_pending = true", processor)

    def test_authenticated_preserves_voice_recovery_before_pairing_recovery(self) -> None:
        source = self.read_api()
        authenticated = source[
            source.index('if (strcmp(event, "authenticated") == 0)') :
            source.index('else if (strcmp(event, "authentication_failed") == 0)')
        ]

        self.assertIn("adopt_recovered_request", authenticated)
        self.assertIn("flush_pending_playback_event", authenticated)
        self.assertIn("pairing_on_authenticated", authenticated)
        self.assertLess(
            authenticated.index("flush_pending_playback_event"),
            authenticated.index("pairing_on_authenticated"),
        )
        self.assertNotIn("send_pairing_mode_request", authenticated)

    def test_socket_lifecycle_notifies_controller(self) -> None:
        source = self.read_api()
        event_handler = function_body(source, r"static\s+void\s+websocket_event_handler\s*\([^)]*\)")
        mark_down = function_body(source, r"static\s+void\s+mark_ws_down\s*\([^)]*\)")

        self.assertIn("WEBSOCKET_EVENT_CONNECTED", event_handler)
        self.assertIn("pairing_on_socket_connected", event_handler)
        self.assertIn("pairing_on_disconnected", mark_down)

    def test_intentional_pairing_reconnect_is_monitor_owned_and_immediate(self) -> None:
        source = self.read_api()
        monitor = function_body(source, r"static\s+void\s+ws_monitor_task\s*\([^)]*\)")

        self.assertIn("process_pairing_actions();", monitor)
        self.assertIn("ws_pairing_reconnect_pending", monitor)
        self.assertIn('stop_ws_if_started("pairing_completed")', monitor)
        self.assertIn('start_ws_if_network_ready("pairing_reconnect")', monitor)
        reconnect_start = monitor.index('start_ws_if_network_ready("pairing_reconnect")')
        normal_backoff = monitor.index("if (!ws_client_started && ws_reconnect_pending)")
        self.assertLess(reconnect_start, normal_backoff)

    def test_recovery_completion_clears_reconnect_action_in_controller(self) -> None:
        source = PAIRING_SOURCE.read_text(encoding="utf-8")
        completion = function_body(source, r"void\s+pairing_on_completed\s*\([^)]*\)")

        self.assertIn("completion_is_recovery", completion)
        self.assertIn("PairingPhase::RECOVERY_SENT", completion)
        self.assertIn("PairingPhase::NONE", completion)
        self.assertIn("clear_action_locked(PAIRING_ACTION_RECONNECT)", completion)
        self.assertIn("queue_action_locked(PAIRING_ACTION_RECONNECT)", completion)

    def test_connection_replaced_suppression_remains_independent(self) -> None:
        source = self.read_api()
        branch = self.event_branch(
            source,
            "connection_replaced",
            "else if (!ws_authenticated)",
        )

        self.assertIn("ws_connection_replacement_suppressed = true", branch)
        self.assertIn("ws_reconnect_pending = false", branch)
        self.assertNotIn("ws_pairing_reconnect_pending = true", branch)

    def test_existing_voice_events_and_recovery_helpers_remain(self) -> None:
        source = self.read_api()

        for event in (
            '"authenticate"',
            '"authenticated"',
            '"authentication_failed"',
            '"connection_replaced"',
            '"display_status"',
            '"audio_ready"',
            '"request_failed"',
            '"audio_playback_done"',
            '"audio_playback_failed"',
        ):
            self.assertIn(event, source)
        self.assertIn("mark_request_result_sent", source)
        self.assertIn("flush_pending_playback_event", source)

    def test_existing_dirty_tree_voice_fixes_remain(self) -> None:
        source = self.read_api()
        mark_sent = function_body(source, r"static\s+void\s+mark_request_result_sent\s*\([^)]*\)")

        self.assertIn("esp_http_client_get_response_header", source)
        self.assertIn("is_audio_mpeg_content_type", source)
        self.assertIn("MP3 playback progress", source)
        self.assertIn("decoded_frames", source)
        self.assertIn("const bool matches_current", mark_sent)
        self.assertIn("const bool matches_backend", mark_sent)


if __name__ == "__main__":
    unittest.main()
