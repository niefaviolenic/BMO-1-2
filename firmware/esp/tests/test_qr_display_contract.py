import ctypes
import os
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN_DIR = ROOT / "main"
DISPLAY_H = MAIN_DIR / "display.h"
DISPLAY_CPP = MAIN_DIR / "display.cpp"
API_CPP = MAIN_DIR / "api.cpp"
BUTTON_CPP = MAIN_DIR / "button.cpp"
WAKEWORD_CPP = MAIN_DIR / "wakeword.cpp"
PAIRING_H = MAIN_DIR / "pairing.h"
PAIRING_CPP = MAIN_DIR / "pairing.cpp"
CMAKELISTS = MAIN_DIR / "CMakeLists.txt"
QRCODEGEN_C = MAIN_DIR / "qrcodegen.c"
QRCODEGEN_H = MAIN_DIR / "qrcodegen.h"


class QrDisplayContractTest(unittest.TestCase):
    def read(self, path: Path) -> str:
        self.assertTrue(path.exists(), f"required file is missing: {path}")
        return path.read_text(encoding="utf-8")

    def test_cmakelists_registers_qrcodegen_c(self) -> None:
        cmake = self.read(CMAKELISTS)
        self.assertIn('"qrcodegen.c"', cmake)

    def test_display_h_exports_qr_functions(self) -> None:
        header = self.read(DISPLAY_H)
        self.assertRegex(
            header,
            r"bool\s+display_set_qr_code\s*\(\s*const\s+char\s*\*\s*qr_payload\s*,\s*time_t\s+expires_at_epoch\s*\)\s*;",
        )
        self.assertRegex(
            header,
            r"void\s+display_update_qr_countdown\s*\(\s*\)\s*;",
        )
        self.assertRegex(
            header,
            r"void\s+display_clear_qr_code\s*\(\s*\)\s*;",
        )
        self.assertRegex(
            header,
            r"bool\s+display_qr_code_is_visible\s*\(\s*\)\s*;",
        )

    def test_display_cpp_implements_qr_functions_and_renderer(self) -> None:
        source = self.read(DISPLAY_CPP)
        self.assertIn('#include "qrcodegen.h"', source)
        self.assertIn("bool display_set_qr_code", source)
        self.assertIn("void display_update_qr_countdown", source)
        self.assertIn("void display_clear_qr_code", source)
        self.assertIn("bool display_qr_code_is_visible", source)
        self.assertIn("draw_qr_overlay_locked", source)
        self.assertIn("secure_clear_qr_code_locked", source)
        self.assertIn("qrcodegen_encodeText", source)
        self.assertIn("QR_MAX_VERSION = 15", source)
        self.assertIn("fill_rect(0, 0, LCD_H_RES, LCD_V_RES, COLOR_WHITE)", source)
        self.assertIn("(LCD_H_RES - qr_pixel_size) / 2", source)
        self.assertIn("(LCD_V_RES - qr_pixel_size) / 2", source)
        self.assertIn("quiet_zone_modules = 4", source)
        self.assertIn("clamp_value(LCD_V_RES / (qr_size + 2 * quiet_zone_modules), 1, 4)", source)
        self.assertIn("!qr_code_active", source)

    def test_pairing_exports_parse_rfc3339_utc_externally(self) -> None:
        header = self.read(PAIRING_H)
        source = self.read(PAIRING_CPP)

        self.assertRegex(header, r"bool\s+parse_rfc3339_utc\s*\(\s*const\s+char\s*\*\s*text\s*,\s*time_t\s*\*\s*epoch_out\s*\)\s*;")
        # Ensure parse_rfc3339_utc is defined outside the anonymous namespace
        self.assertIn("bool parse_rfc3339_utc(const char *text, time_t *epoch_out)", source)

    def test_api_cpp_handles_display_qr_and_clear_qr_events(self) -> None:
        api = self.read(API_CPP)
        self.assertIn('else if (strcmp(event, "display_qr") == 0)', api)
        self.assertIn('else if (strcmp(event, "clear_qr") == 0)', api)
        self.assertIn("display_set_qr_code", api)
        self.assertIn("display_clear_qr_code", api)
        self.assertIn("parse_rfc3339_utc", api)
        self.assertIn("expires_epoch > now_epoch", api)

        # In ws_monitor_task
        self.assertIn("display_qr_code_is_visible()", api)
        self.assertIn("display_update_qr_countdown()", api)

    def test_button_and_wakeword_guard_against_qr_mode(self) -> None:
        button = self.read(BUTTON_CPP)
        self.assertIn("display_qr_code_is_visible()", button)

        wakeword = self.read(WAKEWORD_CPP)
        self.assertGreaterEqual(wakeword.count("display_qr_code_is_visible()"), 2)

    def test_qrcodegen_compilation_and_whatsapp_payload_encoding(self) -> None:
        so_path = "/tmp/libqrcodegen_test.so"
        ret = os.system(f"gcc -shared -fPIC -O2 -I{MAIN_DIR} {QRCODEGEN_C} -o {so_path}")
        self.assertEqual(ret, 0, "qrcodegen.c failed to compile as shared library")

        lib = ctypes.CDLL(so_path)
        whatsapp_qr_payload = (
            "2@1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef,"
            "sample_public_key_base64_string_here_for_joy_robot_whatsapp_sync,"
            "sample_client_token,sample_client_id"
        )
        temp_buf = (ctypes.c_uint8 * 4000)()
        qr_buf = (ctypes.c_uint8 * 4000)()

        ok = lib.qrcodegen_encodeText(
            whatsapp_qr_payload.encode("utf-8"),
            temp_buf,
            qr_buf,
            0,  # ECC Low
            1,  # minVersion
            40, # maxVersion
            -1, # mask AUTO
            True, # boostEcl
        )
        self.assertTrue(ok, "qrcodegen_encodeText failed on WhatsApp QR payload")
        size = lib.qrcodegen_getSize(qr_buf)
        self.assertGreaterEqual(size, 21)
        self.assertLessEqual(size, 177)

        # Verify finder pattern top-left (7x7 with black border, white inner ring, black center)
        # (0,0) is black
        self.assertTrue(lib.qrcodegen_getModule(qr_buf, 0, 0))
        # (0,6) is black
        self.assertTrue(lib.qrcodegen_getModule(qr_buf, 0, 6))
        # (6,0) is black
        self.assertTrue(lib.qrcodegen_getModule(qr_buf, 6, 0))
        # (6,6) is black
        self.assertTrue(lib.qrcodegen_getModule(qr_buf, 6, 6))
        # (1,1) is white
        self.assertFalse(lib.qrcodegen_getModule(qr_buf, 1, 1))
        # (3,3) center is black
        self.assertTrue(lib.qrcodegen_getModule(qr_buf, 3, 3))


if __name__ == "__main__":
    unittest.main()
