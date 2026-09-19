import subprocess
import time
import sys

ADB = r"C:\Users\cenna\AppData\Local\Android\Sdk\platform-tools\adb.exe"

def wait_for_device():
    print("[MOBILE] Checking for connected Android devices via ADB...")
    while True:
        try:
            res = subprocess.run([ADB, "devices"], capture_output=True, text=True)
            lines = res.stdout.strip().split("\n")[1:]
            devices = [line.split()[0] for line in lines if "\tdevice" in line]
            if devices:
                dev = devices[0]
                print(f"[MOBILE] Connected to Android device: {dev}")
                return dev
            unauth = [line.split()[0] for line in lines if "\tunauthorized" in line]
            if unauth:
                print(f"[MOBILE] Device {unauth[0]} is UNAUTHORIZED. Please check phone screen and 'Allow USB Debugging'.")
        except Exception as e:
            print(f"[MOBILE] Error querying adb: {e}")
        time.sleep(2)

def stream_logcat(dev):
    print("[MOBILE] Clearing logcat buffer...")
    subprocess.run([ADB, "-s", dev, "logcat", "-c"])
    print("[MOBILE] Streaming logcat (filtering for Joy app & BLE)...")
    
    # Run logcat
    cmd = [
        ADB, "-s", dev, "logcat", "-v", "time",
        "ReactNativeJS:V", "ReactNative:V", "JoyBLE:V", "BleClient:V", "*:W"
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    try:
        for line in proc.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
    except KeyboardInterrupt:
        print("\n[MOBILE] Logcat stopped.")
    finally:
        proc.terminate()

if __name__ == "__main__":
    while True:
        dev = wait_for_device()
        stream_logcat(dev)
        print("[MOBILE] Device disconnected or logcat exited. Re-checking...")
        time.sleep(2)
