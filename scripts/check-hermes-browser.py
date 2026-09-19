#!/usr/bin/env python3
"""Exercise Hermes' actual headless browser without an LLM or Telegram message."""

import json
import os
from pathlib import Path
import re
import shutil
import sys

if "--inside" not in sys.argv:
    wrapper = Path(shutil.which("hermes-agent")).read_text()
    python = re.search(r"^export HERMES_PYTHON='([^']+)'$", wrapper, re.MULTILINE)
    assert python, "Cannot locate Hermes Python"
    os.execv(python[1], [python[1], str(Path(__file__).resolve()), "--inside"])

from hermes_cli.env_loader import load_hermes_dotenv
from hermes_cli.config import load_config_readonly

load_hermes_dotenv()
config = load_config_readonly()
assert config["browser"]["backend"] == "browser-use"
assert config["browser"]["cloud_provider"] == "local"
assert config["browser"]["headed"] is False

from model_tools import get_tool_definitions
from tools.browser_tool_lifecycle import cleanup_all_browsers
from tools.browser_tool_install import _chromium_installed
from tools.browser_use_cli import browser_exec

assert _chromium_installed(), "Chromium unavailable"
for toolsets in [config["platform_toolsets"]["cli"], ["hermes-telegram"]]:
    definitions = get_tool_definitions(
        enabled_toolsets=toolsets,
        disabled_toolsets=config.get("disabled_toolsets", []),
        quiet_mode=True,
    )
    assert any(d["function"]["name"] == "browser_exec" for d in definitions), toolsets

try:
    result = browser_exec(
        '# Verify headless browsing\nnew_tab("https://example.com"); print(js("document.title"))',
        session=f"nix-check-{os.getpid()}",
        task_id=f"nix-check-{os.getpid()}",
        timeout_s=90,
    )
    if isinstance(result, str):
        result = json.loads(result)
    assert result.get("success"), result
    assert "Example Domain" in result.get("output", ""), result
    print(f"PASS uid={os.getuid()}: CLI/Telegram browser tool, headless HTTPS page load")
finally:
    cleanup_all_browsers()
