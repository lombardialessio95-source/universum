#!/usr/bin/env python3
"""Run the trusted recovery against a disposable local Firestore instance."""
import os
from pathlib import Path
import socket
import subprocess
import time

root = Path(__file__).resolve().parent.parent
with socket.socket() as probe:
    probe.bind(("127.0.0.1", 0))
    port = probe.getsockname()[1]
emulator = subprocess.Popen(
    ["java", "-XX:ActiveProcessorCount=2", "-jar", os.environ["FIRESTORE_EMULATOR_JAR"],
     "--host", "127.0.0.1", "--port", str(port), "--rules", str(root / "firestore.rules")],
    stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
)
try:
    for _ in range(100):
        try:
            with socket.create_connection(("127.0.0.1",port),timeout=.2):
                break
        except OSError:
            time.sleep(.2)
    else:
        raise RuntimeError("Firestore emulator did not start")
    subprocess.run(["node", str(root / "services/suprema/smoke-emulator.js")], check=True,
                   env={**os.environ, "FIRESTORE_EMULATOR_HOST": f"127.0.0.1:{port}"})
finally:
    emulator.terminate()
    emulator.wait(timeout=15)
