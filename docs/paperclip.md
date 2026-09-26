# Paperclip on herdr

Paperclip replaces Charon at `http://herdr/`. Nix owns the pinned application
package, Node runtime, PostgreSQL database/role, backups, systemd services and
Nginx on port 80. Tailscale Serve continues forwarding HTTPS to that port.
The firewall only permits access through the existing trusted tailnet interface.

## Activate

From this checkout:

```sh
sudo nixos-rebuild switch --flake /code/herdr#herdr
systemctl status paperclip postgresql nginx
curl --fail http://herdr/api/health
```

Alternatively, once these changes are pushed, use `pullrebuild` from the normal
`/etc/nixos` checkout. Do not run Paperclip's shell installer, onboard daemon
installer, or a separate database container.

Open `http://herdr/` and complete Paperclip's account/company setup. This uses
upstream's authenticated private deployment mode. If Paperclip reports that the
board needs claiming, obtain its claim URL from `journalctl -u paperclip` and
open the same path/query on `http://herdr/`. Treat that claim URL as private.

## Agents

The server runs as `richard`, with `/home/richard` as HOME and the Nix system
tools on PATH. It can access `/code` and Richard's existing Codex/Hermes CLI
profiles. It is intentionally a trusted local process with Richard's access.
The Telegram gateway still runs separately as `hermes`.

In Paperclip, create these two agents and use **Test Environment** for each:

- Codex: `codex_local`, working directory `/code/herdr`, initially `engine: cli`.
  This uses the installed Codex CLI and avoids an additional ACP executable
  download. Use the model you want in the UI and verify its login in the
  adapter test. Paperclip manages its own agent sessions.
- Hermes: `hermes_local`, command `/run/current-system/sw/bin/hermes`, working
  directory `/code/herdr`, provider `openai-codex`, model `gpt-5.6-terra`.
  Our launcher chooses Richard's `~/.hermes`; setting a different HERMES_HOME
  in Paperclip does not override that launcher. Do not point it at the
  Telegram gateway's private profile. If its login has expired, authenticate
  Richard's CLI with `hermes auth add openai-codex --type oauth --no-browser`.

An environment test can make a small model request. Deployment itself does not
run agents, create work, or send Telegram messages. Telegram completion/blocker
delivery is a separate integration to verify; the local adapter alone does not
connect Paperclip issue comments to the existing Telegram conversation.

## Data and maintenance

- PostgreSQL 17, database/role `paperclip`, local Unix socket only. Peer mapping
  permits the `richard` OS account to connect as the `paperclip` DB role.
- Paperclip files: `/var/lib/paperclip`, including uploaded artifacts and state.
- Auth/JWT/encryption secrets: `/var/lib/paperclip/runtime.env`, created once
  by `paperclip-secrets.service`, never stored in Git or the Nix store.
- NixOS PostgreSQL backup: daily at 03:15 UTC under `/var/backup/postgresql`.
  Also back up `/var/lib/paperclip` securely: a database dump alone cannot
  restore uploaded files or encrypted secrets. CLI profiles remain separate.
- The pinned package is in `packages/paperclip`; it installs from a checked-in
  npm lockfile and a fixed Nix dependency hash. No npm install runs at boot.
- A small packaged browser shim supplies UUID v4 using `getRandomValues` when
  `crypto.randomUUID` is unavailable on `http://herdr`. It loads before the
  upstream UI bundle and leaves native HTTPS implementations intact.
- Paperclip applies its migrations on startup. Back up the database and state
  before changing the package version; Nix rollback does not reverse migrations.

## Charon suspension and rollback

With `services.paperclip.enable = true`, Charon's production unit and release
watcher are disabled, its MCP registration is omitted, and its Hermes polling
schedule is paused through the supported CLI. The retirement unit stops the old
Compose containers and disables their restart policy. It also disables the old
user bridge when Richard's user manager is available. No data is deleted.

For rollback, set `services.paperclip.enable = false` and rebuild. This removes
the Paperclip web service and restores Charon's Nix definitions. Restore the
appropriate Charon deployment deliberately; the old development container's
restart policy is not automatically re-enabled. Resume the preserved Hermes
schedule explicitly only once Charon is healthy. PostgreSQL/Paperclip data is
retained on disk. Do not run both applications on port 80.

## Upstream references

- [Paperclip](https://github.com/paperclipai/paperclip)
- [Codex adapter](https://docs.paperclip.ing/reference/adapters/codex/)
- [Hermes adapter](https://docs.paperclip.ing/reference/adapters/hermes/)
- [Database](https://github.com/paperclipai/paperclip/blob/master/docs/deploy/database.md)
- [Private access](https://github.com/paperclipai/paperclip/blob/master/docs/deploy/tailscale-private-access.md)
