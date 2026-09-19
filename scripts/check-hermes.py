#!/usr/bin/env python3
"""Run as each operator on herdr; print verdicts, never credential values."""

import os
from pathlib import Path
import re
import shutil
import sys


if "--inside" not in sys.argv:
    wrapper = Path(shutil.which("hermes")).read_text()
    python = re.search(r"^export HERMES_PYTHON='([^']+)'$", wrapper, re.MULTILINE)
    assert python, "Cannot locate the installed Hermes Python environment"
    os.execv(python[1], [python[1], str(Path(__file__).resolve()), "--inside"])

from hermes_cli.config import load_config_readonly
from hermes_cli.env_loader import load_hermes_dotenv
from hermes_constants import get_hermes_home


expected = Path("/var/lib/hermes/.hermes")
assert get_hermes_home().resolve() == expected, "Hermes selected a different profile"
assert (Path.home() / ".hermes").resolve() == expected, "Home symlink missing"

# A cold process must obtain its credentials from disk, with no shell exports.
required = ["OPENCODE_GO_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_ALLOWED_USERS"]
for key in required:
    os.environ.pop(key, None)
loaded = load_hermes_dotenv()
assert expected / ".env" in [p.resolve() for p in loaded], "Shared secrets not loaded"
for key in required:
    assert os.environ.get(key), f"{key} missing from first-session environment"
assert not (expected / ".env").stat().st_mode & 0o007, "Secrets are world-accessible"

config = load_config_readonly()
assert config["model"]["provider"] == "opencode-go", "Wrong provider"
assert config["model"]["default"] == "mimo-v2.5", "Wrong model"
assert "Marvin" in (expected / "SOUL.md").read_text(), "Marvin identity missing"

# Exercise the shared session database as this user without modifying sessions.
import sqlite3

with sqlite3.connect(f"file:{expected}/state.db?mode=rw", uri=True) as db:
    db.execute("BEGIN IMMEDIATE")
    db.execute("ROLLBACK")
print(f"PASS uid={os.getuid()}: shared profile, cold secret load, model, soul, database access")
