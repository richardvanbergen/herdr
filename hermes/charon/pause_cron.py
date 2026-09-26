"""Pause only Charon's schedule through Hermes's locking CLI; retain its history."""
import json
import os
from pathlib import Path
import subprocess
import sys

store = Path(os.environ["HERMES_HOME"]) / "cron" / "jobs.json"
data = json.loads(store.read_text()) if store.exists() else {"jobs": []}
rows = data if isinstance(data, list) else data["jobs"]
for job in rows:
    if job.get("name") == "charon-ready-jobs":
        subprocess.run([sys.argv[1], "cron", "pause", job["id"]], check=True)
