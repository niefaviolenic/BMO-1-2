import sys
import time
import serial

PORT = sys.argv[1] if len(sys.argv) > 1 else "COM12"
BAUD = int(sys.argv[2]) if len(sys.argv) > 2 else 115200

print(f"[SERIAL] Connecting to {PORT} at {BAUD} baud...")
try:
    ser = serial.Serial(PORT, BAUD, timeout=0.1)
    print(f"[SERIAL] Connected to {PORT} successfully. Listening for ESP32 logs...")
except Exception as e:
    print(f"[SERIAL] Failed to open {PORT}: {e}")
    sys.exit(1)

try:
    while True:
        line = ser.readline()
        if line:
            try:
                decoded = line.decode('utf-8', errors='replace')
                sys.stdout.write(decoded)
                sys.stdout.flush()
            except Exception:
                pass
except KeyboardInterrupt:
    print("\n[SERIAL] Exiting monitor.")
finally:
    ser.close()
