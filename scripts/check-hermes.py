#!/usr/bin/env python3
"""Run as each operator on herdr; print verdicts, never credential values."""

import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


if "--inside" not in sys.argv:
    # The companion executable belongs to the same sealed Python package;
    # `hermes` itself is the operator launcher that selects per-user state.
    wrapper = Path(shutil.which("hermes-agent")).read_text()
    python = re.search(r"^export HERMES_PYTHON='([^']+)'$", wrapper, re.MULTILINE)
    assert python, "Cannot locate the installed Hermes Python environment"
    os.execv(python[1], [python[1], str(Path(__file__).resolve()), "--inside"])

from hermes_cli.config import load_config_readonly
from hermes_cli.env_loader import load_hermes_dotenv
from hermes_constants import get_hermes_home


expected = Path.home() / ".hermes"
shared = Path("/var/lib/hermes-config")
assert get_hermes_home().resolve() == expected, "Hermes selected a different profile"
assert not expected.is_symlink(), "Each account must own its mutable state"
for name in [".env", "config.yaml", "SOUL.md"]:
    assert (expected / name).resolve() == shared / name, f"{name} is not shared"

# A cold process must obtain its credentials from disk, with no shell exports.
required = ["OPENCODE_GO_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_ALLOWED_USERS"]
for key in required:
    os.environ.pop(key, None)
loaded = load_hermes_dotenv()
assert shared / ".env" in [p.resolve() for p in loaded], "Shared secrets not loaded"
for key in required:
    assert os.environ.get(key), f"{key} missing from first-session environment"
assert not (expected / ".env").stat().st_mode & 0o007, "Secrets are world-accessible"

config = load_config_readonly()
assert config["model"]["provider"] == "opencode-go", "Wrong provider"
assert config["model"]["default"] == "qwen3.7-max", "Wrong model"
assert "Marvin" in (expected / "SOUL.md").read_text(), "Marvin identity missing"

# Exercise the real CLI: Hermes re-applies 0600 to SQLite files on every open,
# so a direct SQLite check immediately after activation misses the regression.
from hermes_state import SessionDB

# Read-only session listing does not create a fresh database; use the same
# initializer as chat startup to cover a genuinely empty first-session profile.
database = SessionDB()
database.close()
cli_env = dict(os.environ)
for key in required:
    cli_env.pop(key, None)
# An existing shell may still export the old global path; the launcher must
# select the caller's profile even then.
cli_env["HERMES_HOME"] = str(shared)
result = subprocess.run(
    ["hermes", "sessions", "list"], env=cli_env, capture_output=True, text=True, timeout=30
)
assert result.returncode == 0, "Hermes CLI cannot read its session database"
assert (expected / "state.db").stat().st_uid == os.getuid(), "Database belongs to another account"
print(f"PASS uid={os.getuid()}: cold secret load, shared model/soul, per-user sessions CLI")
