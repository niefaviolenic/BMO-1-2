import sys
import time
import serial

PORT = sys.argv[1] if len(sys.argv) > 1 else "COM12"
BAUD = int(sys.argv[2]) if len(sys.argv) > 2 else 115200

while True:
    try:
        print(f"[SERIAL] Connecting to {PORT} at {BAUD} baud...")
        with serial.Serial(PORT, BAUD, timeout=0.1) as ser:
            print(f"[SERIAL] Connected to {PORT} successfully. Listening for ESP32 logs...")
            while True:
                line = ser.readline()
                if line:
                    try:
                        decoded = line.decode('utf-8', errors='replace')
                        sys.stdout.write(decoded)
                        sys.stdout.flush()
                    except Exception:
                        pass
    except serial.SerialException as e:
        print(f"[SERIAL] Port error: {e}. Reconnecting in 1s...")
        time.sleep(1)
    except KeyboardInterrupt:
        print("\n[SERIAL] Exiting monitor.")
        break
    except Exception as e:
        print(f"[SERIAL] Unexpected error: {e}. Reconnecting in 1s...")
        time.sleep(1)
