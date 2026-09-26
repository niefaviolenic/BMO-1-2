import sys
import time
import serial
import serial.tools.list_ports
import threading

def detect_port():
    if len(sys.argv) > 1:
        return sys.argv[1]
    for p in serial.tools.list_ports.comports():
        if "CH34" in p.description or "ESP" in p.description or "CP210" in p.description or "Serial" in p.description:
            return p.device
    return "COM7"

PORT = detect_port()
BAUD = int(sys.argv[2]) if len(sys.argv) > 2 else 115200

while True:
    try:
        print(f"[SERIAL] Connecting to {PORT} at {BAUD} baud...")
        with serial.Serial(PORT, BAUD, timeout=0.1) as ser:
            print(f"[SERIAL] Connected to {PORT} successfully. Type commands (e.g. EXPR:SAD, HELP) or listen for logs...")
            
            def input_loop():
                while ser.is_open:
                    try:
                        cmd = input()
                        ser.write((cmd + "\n").encode('utf-8'))
                        ser.flush()
                    except (EOFError, KeyboardInterrupt):
                        break
                    except Exception:
                        pass
            
            t = threading.Thread(target=input_loop, daemon=True)
            t.start()
            
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
