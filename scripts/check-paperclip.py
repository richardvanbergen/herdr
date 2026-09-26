"""Smoke-test a built Paperclip package with disposable PostgreSQL; no model calls.
Usage: python3 scripts/check-paperclip.py PAPERCLIP_STORE_PATH POSTGRES_STORE_PATH
"""
import http.cookiejar
import getpass
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

app, postgres = map(Path, sys.argv[1:])

def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]

with tempfile.TemporaryDirectory(prefix="paperclip-smoke-") as root:
    root = Path(root)
    db, state = root / "db", root / "state"
    state.mkdir()
    dbport, port = free_port(), free_port()
    log = root / "server.log"
    env = {**os.environ, "HOME": str(root), "PAPERCLIP_HOME": str(state),
           "HOST": "127.0.0.1", "PORT": str(port), "PAPERCLIP_BIND": "loopback",
           "NODE_ENV": "production", "SERVE_UI": "true",
           "PAPERCLIP_DEPLOYMENT_MODE": "authenticated",
           "PAPERCLIP_DEPLOYMENT_EXPOSURE": "private",
           "PAPERCLIP_AUTH_BASE_URL_MODE": "auto",
           "PAPERCLIP_ALLOWED_HOSTNAMES": "herdr,127.0.0.1,localhost,paperclip-test.invalid",
           "PAPERCLIP_MIGRATION_AUTO_APPLY": "true",
           "PAPERCLIP_MIGRATION_PROMPT": "never",
           "PAPERCLIP_DB_BACKUP_ENABLED": "false",
           "HEARTBEAT_SCHEDULER_ENABLED": "false",
           "BETTER_AUTH_SECRET": secrets.token_hex(32),
           "PAPERCLIP_AGENT_JWT_SECRET": secrets.token_hex(32),
           "PAPERCLIP_SECRETS_MASTER_KEY": secrets.token_hex(32)}
    def pg(command, *args):
        return subprocess.run([str(postgres / "bin" / command), *args],
                              check=True, capture_output=True, text=True)
    pg("initdb", "-D", str(db), "--no-locale", "--encoding=UTF8", "--auth=trust")
    pg("pg_ctl", "-D", str(db), "-l", str(root / "postgres.log"),
       "-o", f"-k {root} -p {dbport} -h ''", "-w", "start")
    server = None
    try:
        pg("psql", "-h", str(root), "-p", str(dbport), "-d", "postgres", "-c",
           "CREATE ROLE paperclip LOGIN")
        pg("createdb", "-h", str(root), "-p", str(dbport), "-O", "paperclip", "paperclip")
        # Exercise the same Unix socket URL and peer mapping as the Nix service.
        (db / "pg_ident.conf").write_text(f"paperclip {getpass.getuser()} paperclip\n")
        (db / "pg_hba.conf").write_text("local paperclip paperclip peer map=paperclip\nlocal all all trust\n")
        pg("pg_ctl", "-D", str(db), "reload")
        env.update(DATABASE_URL="postgresql:///paperclip", PGHOST=str(root),
                   PGUSER="paperclip", PGPORT=str(dbport))
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}),
                   urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        base = f"http://127.0.0.1:{port}"
        def request(path, payload=None):
            data = None if payload is None else json.dumps(payload).encode()
            return opener.open(urllib.request.Request(base + path, data=data,
                               headers={"Content-Type": "application/json", "Origin": base}), timeout=10)
        with log.open("w") as output:
            server = subprocess.Popen([str(app / "bin/paperclip-server")], cwd=state,
                                      env=env, stdout=output, stderr=subprocess.STDOUT)
            deadline = time.monotonic() + 120
            while time.monotonic() < deadline:
                if server.poll() is not None:
                    raise RuntimeError("Server exited during startup")
                try:
                    health = json.load(request("/api/health"))
                    if health["status"] == "ok":
                        break
                    time.sleep(1)
                except (OSError, urllib.error.URLError):
                    time.sleep(1)
            else:
                raise RuntimeError("Server startup timed out")
            html = request("/").read().decode()
            assert '<div id="root">' in html or '<div id="root"' in html
            asset = re.search(r'(?:src|href)="(/assets/[^\"]+\.js)"', html)
            assert asset, "Built UI JavaScript missing"
            assert request(asset[1]).status == 200
            user = json.load(request("/api/auth/sign-up/email", {
                "email": "smoke@example.com", "password": secrets.token_urlsafe(24), "name": "Smoke Test"}))
            assert user.get("user"), user
            session = json.load(request("/api/auth/get-session"))
            assert session.get("user", {}).get("email") == "smoke@example.com", session
            assert json.load(request("/api/bootstrap/claim", {}))["claimed"]
            assert json.load(request("/api/health"))["bootstrapStatus"] == "ready"
            assert json.load(request("/api/companies")) == []
            print("PASS: migrations, PostgreSQL peer/socket connection, health, UI/assets, signup, session and first-admin claim")
            if os.environ.get("PAPERCLIP_TEST_BROWSER") == "1":
                debug_port = free_port()
                with (root / "browser.log").open("w") as browser_log:
                    browser = subprocess.Popen([
                        shutil.which("chromium"), "--headless", "--no-sandbox", "--disable-gpu",
                        "--no-proxy-server", "--host-resolver-rules=MAP paperclip-test.invalid 127.0.0.1",
                        f"--remote-debugging-port={debug_port}", f"--user-data-dir={root / 'browser'}",
                        "about:blank"], stdout=browser_log, stderr=subprocess.STDOUT)
                    try:
                        debug_origin = f"http://127.0.0.1:{debug_port}"
                        for _ in range(100):
                            try:
                                opener.open(debug_origin + "/json/version", timeout=1).close()
                                break
                            except OSError:
                                time.sleep(0.1)
                        subprocess.run(["bun", str(Path(__file__).with_name("check-paperclip-http.mjs")),
                                        debug_origin, f"http://paperclip-test.invalid:{port}"], check=True, timeout=60)
                    finally:
                        browser.terminate()
                        browser.wait(timeout=15)
    except Exception:
        # Logs belong only to the disposable instance, never the real server.
        print(log.read_text()[-8000:] if log.exists() else "No server log", file=sys.stderr)
        raise
    finally:
        if server and server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=15)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
        pg("pg_ctl", "-D", str(db), "-m", "immediate", "-w", "stop")
