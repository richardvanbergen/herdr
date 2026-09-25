"""Idempotently register the Nix-owned schedule using Hermes's public CLI.
Read the store only to find identity; Hermes performs every mutation under its lock.
"""
import json
import os
from pathlib import Path
import subprocess
import sys

name = "charon-ready-jobs"
store = Path(os.environ["HERMES_HOME"]) / "cron" / "jobs.json"
data = json.loads(store.read_text()) if store.exists() else {"jobs": []}
rows = data if isinstance(data, list) else data["jobs"]
matches = [job for job in rows if job.get("name") == name]
if len(matches) > 1:
    raise SystemExit("Multiple charon-ready-jobs schedules exist; resolve duplicates first.")
prompt = Path(sys.argv[2]).read_text()
cli = sys.argv[1]
if matches:
    command = [cli, "cron", "edit", matches[0]["id"], "--schedule", "every 2m", "--prompt", prompt, "--deliver", "telegram"]
else:
    command = [cli, "cron", "create", "every 2m", prompt, "--name", name, "--deliver", "telegram"]
subprocess.run(command, check=True)
# Preserve an operator's paused state on rebuild; initial creation is enabled.
