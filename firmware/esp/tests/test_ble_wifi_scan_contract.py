import unittest
from pathlib import Path

ESP_ROOT = Path(__file__).resolve().parents[1]
WIFI_H = ESP_ROOT / "main" / "wifi.h"
WIFI_CPP = ESP_ROOT / "main" / "wifi.cpp"
NIMBLE_H = ESP_ROOT / "main" / "joy_ble_nimble.h"
NIMBLE_CPP = ESP_ROOT / "main" / "joy_ble_nimble.cpp"


class BleWifiScanContractTest(unittest.TestCase):
    def test_wifi_header_exposes_scan_helper(self) -> None:
        header = WIFI_H.read_text(encoding="utf-8")
        self.assertIn("char *wifi_scan_nearby_aps_json(void);", header)

    def test_wifi_source_implements_scan_and_filters(self) -> None:
        source = WIFI_CPP.read_text(encoding="utf-8")
        self.assertIn("char *wifi_scan_nearby_aps_json(void)", source)
        self.assertIn("esp_wifi_scan_start", source)
        self.assertIn("esp_wifi_scan_get_ap_records", source)
        self.assertIn("qsort(unique_aps", source)
        self.assertIn('"networks"', source)
        self.assertIn('"security"', source)

    def test_nimble_header_exposes_notify_wifi_scan(self) -> None:
        header = NIMBLE_H.read_text(encoding="utf-8")
        self.assertIn("void joy_ble_nimble_notify_wifi_scan(const char *json_str);", header)

    def test_nimble_registers_chr_wifi_scan_0000fe07(self) -> None:
        source = NIMBLE_CPP.read_text(encoding="utf-8")
        # Base UUID with 0x07 for char 7
        self.assertIn("0x07, 0xfe, 0x00, 0x00", source)
        self.assertIn("gatt_svr_chr_wifi_scan_uuid", source)
        self.assertIn("gatt_svr_chr_access_wifi_scan", source)
        self.assertIn("joy_ble_nimble_notify_wifi_scan", source)


if __name__ == "__main__":
    unittest.main()
