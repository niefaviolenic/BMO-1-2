import re
import unittest
from pathlib import Path


ESP_ROOT = Path(__file__).resolve().parents[1]
WIFI_HEADER = ESP_ROOT / "main" / "wifi.h"
WIFI_SOURCE = ESP_ROOT / "main" / "wifi.cpp"
MAIN_SOURCE = ESP_ROOT / "main" / "main.cpp"


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


class WifiFinalizeTaskContractTest(unittest.TestCase):
    def read_required(self, path: Path) -> str:
        self.assertTrue(path.exists(), f"required file is missing: {path.name}")
        return path.read_text(encoding="utf-8")

    def test_wifi_header_declares_wifi_poll(self) -> None:
        header = self.read_required(WIFI_HEADER)
        self.assertIn("void wifi_poll(void);", header)

    def test_main_cpp_calls_wifi_poll_in_main_loop(self) -> None:
        main_cpp = self.read_required(MAIN_SOURCE)
        main_body = function_body(main_cpp, r"extern\s+\"C\"\s+void\s+app_main\s*\([^)]*\)")
        self.assertIn("wifi_poll()", main_body)
        self.assertIn("joy_ble_poll()", main_body)

    def test_wifi_source_includes_heap_caps(self) -> None:
        source = self.read_required(WIFI_SOURCE)
        self.assertIn("esp_heap_caps.h", source)

    def test_wifi_source_implements_wifi_poll_and_try_start_worker(self) -> None:
        source = self.read_required(WIFI_SOURCE)
        self.assertIn("void wifi_poll(void)", source)
        self.assertIn("try_start_finalize_worker", source)

    def test_finalize_task_creation_is_checked_and_logged(self) -> None:
        source = self.read_required(WIFI_SOURCE)
        self.assertIn("xTaskCreateWithCaps", source)
        self.assertIn("MALLOC_CAP_SPIRAM", source)
        self.assertIn("MALLOC_CAP_8BIT", source)
        self.assertIn("heap_caps_get_largest_free_block", source)
        self.assertIn("esp_get_free_heap_size", source)

    def test_finalize_worker_logs_stack_high_water_mark(self) -> None:
        source = self.read_required(WIFI_SOURCE)
        task_body = function_body(source, r"static\s+void\s+finalize_worker_task\s*\([^)]*\)")
        self.assertIn("uxTaskGetStackHighWaterMark", task_body)

    def test_event_handler_does_not_call_finalize_synchronously(self) -> None:
        source = self.read_required(WIFI_SOURCE)
        handler_body = function_body(source, r"static\s+void\s+event_handler\s*\([^)]*\)")
        self.assertNotIn("joy_ble_finalize_with_backend()", handler_body)


if __name__ == "__main__":
    unittest.main()
