import re
import unittest
from pathlib import Path


ESP_ROOT = Path(__file__).resolve().parents[1]
WIFI_SOURCE = ESP_ROOT / "main" / "wifi.cpp"
NETWORK_HEADER = ESP_ROOT / "main" / "network.h"
NETWORK_SOURCE = ESP_ROOT / "main" / "network.cpp"
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


class SntpSyncContractTest(unittest.TestCase):
    def read_required(self, path: Path) -> str:
        self.assertTrue(path.exists(), f"required file is missing: {path.name}")
        return path.read_text(encoding="utf-8")

    def test_sntp_time_sync_callback_sets_network_time_synced(self) -> None:
        wifi = self.read_required(WIFI_SOURCE)
        callback = function_body(wifi, r"static\s+void\s+sntp_time_sync_callback\s*\([^)]*\)")
        self.assertIn("system_time_is_valid()", callback)
        self.assertIn("network_set_time_synced(true)", callback)

    def test_sntp_event_handler_sets_network_time_synced(self) -> None:
        wifi = self.read_required(WIFI_SOURCE)
        handler = function_body(wifi, r"static\s+void\s+sntp_event_handler\s*\([^)]*\)")
        self.assertIn("system_time_is_valid()", handler)
        self.assertIn("network_set_time_synced(true)", handler)

    def test_time_sync_task_sets_network_time_synced_on_valid_time(self) -> None:
        wifi = self.read_required(WIFI_SOURCE)
        task = function_body(wifi, r"static\s+void\s+time_sync_task\s*\([^)]*\)")
        self.assertIn("system_time_is_valid()", task)
        self.assertIn("network_set_time_synced(true)", task)

    def test_start_time_sync_after_ip_checks_valid_time(self) -> None:
        wifi = self.read_required(WIFI_SOURCE)
        start_sync = function_body(wifi, r"static\s+void\s+start_time_sync_after_ip\s*\([^)]*\)")
        self.assertIn("system_time_is_valid()", start_sync)
        self.assertIn("network_set_time_synced(true)", start_sync)

    def test_network_header_defines_time_synced_bit(self) -> None:
        header = self.read_required(NETWORK_HEADER)
        self.assertIn("NETWORK_TIME_SYNCED_BIT", header)
        self.assertIn("network_set_time_synced", header)
        self.assertIn("network_has_valid_time", header)
        self.assertIn("network_wait_for_valid_time", header)

    def test_api_init_waits_for_valid_time(self) -> None:
        main_cpp = self.read_required(MAIN_SOURCE)
        task = function_body(main_cpp, r"static\s+void\s+api_init_when_network_ready_task\s*\([^)]*\)")
        self.assertIn("network_wait_for_valid_time", task)
        self.assertIn("NETWORK_TIME_SYNCED_BIT", task)


if __name__ == "__main__":
    unittest.main()
