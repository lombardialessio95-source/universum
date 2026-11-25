#!/usr/bin/env python3
"""Create a standalone Firebase Functions staging package, without deploying it."""
from pathlib import Path
import re
import shutil
import sys

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]).resolve()
if out.exists():
    raise SystemExit("Choose a new output directory.")
out.mkdir(parents=True)
service = root / "services/suprema"
engine = (service / "engine.js").read_text()
for name in re.findall(r"'((?:modules/[^']+|data)\.js)'", engine) + [
    "modules/online/siege-recovery.js", "services/suprema/engine.js",
    "services/suprema/recover.js", "services/suprema/functions.js"
]:
    target = out / "functions" / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / name,target)
for name in ["package.json","package-lock.json"]:
    shutil.copy2(service / name,out / "functions" / name)
shutil.copy2(root / "firestore.rules",out / "firestore.rules")
(out / "firebase.json").write_text('{"functions":{"source":"functions"},"firestore":{"rules":"firestore.rules"}}\n')
print(out)
