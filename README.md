# herdr

NixOS flake for the `herdr` box. Hermes runs as one phone gateway, with
`richard` sharing its model configuration, credentials, and identity.

## Hermes and Marvin

`modules/hermes-agent.nix` declares the provider and model:
OpenCode Go / `qwen3.7-max`.

Edit `hermes/SOUL.md` here and rebuild to update Marvin's identity. Nix installs
it at `/var/lib/hermes/.hermes/SOUL.md`. Activation also copies the shared
inputs into root-owned `/var/lib/hermes-config` and links Richard's
`~/.hermes/SOUL.md`, config and `.env` there. Keeping these outside the gateway
profile prevents Hermes' runtime permission hardening from blocking Richard.
Existing unmanaged files are backed up before replacement. Changes to the
deployed soul are overwritten on rebuild.

Each account owns its own CLI sessions and memories. The phone gateway keeps
its conversations in `/var/lib/hermes/.hermes`, owned by `hermes`. Hermes resets
its SQLite database and sidecars to 0600 at runtime; sharing the whole profile
between accounts fails after the gateway opens it. The `hermes` launcher selects
the calling user's `~/.hermes`, including in older shells with a stale global
HERMES_HOME export. It does not use sudo.

Use `hermes` directly after deployment. Do not run `hermes setup` or
`hermes gateway install`: the NixOS module owns setup and the gateway lifecycle.
The phone gateway is `hermes-agent.service`, running as `hermes`.

Managed profiles must have their directory skeleton provisioned before Hermes
starts. This pin's Python loader requires more directories than its Nix module
creates, so this repository provisions the full skeleton for Richard and the service account.

## Secrets and the first session

Secrets are encrypted in `secrets/hermes.yaml` using SOPS and age. `.sops.yaml`
contains only the public recipients: Richard's personal age key and herdr's
SSH Ed25519 host key. Only ciphertext and public keys belong in Git.

On Richard's Mac, `sops` and `age` are installed in `~/.local/bin`. The personal
private key is at `~/Library/Application Support/sops/age/keys.txt` (mode 0600).
Back up that key in your password manager or another secure off-machine location;
it lets you recover and re-encrypt secrets when replacing the server.

To change credentials, from this repository on the Mac:

```sh
sops edit secrets/hermes.yaml
```

Inside the editor, the `hermes-env` value is a multiline dotenv file containing
`OPENCODE_GO_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USERS`, and
`TELEGRAM_HOME_CHANNEL`. Save and close to encrypt. Commit the ciphertext,
deploy the updated checkout to `/etc/nixos`, then run on herdr:

```sh
sudo nixos-rebuild switch --flake /etc/nixos#herdr
```

During activation, SOPS decrypts to `/run/secrets/hermes-env` (root-only).
Hermes' activation script explicitly runs after `setupSecrets`, copies the
values into `/var/lib/hermes/.hermes/.env` (0640, hermes:hermes) and
`/var/lib/hermes-config/.env` (0640, root:hermes), and the gateway
is restarted when the secret changes. Richard belongs to the `hermes`
group, so the first CLI session reads the same credentials. Secrets are not
shell exports: Hermes loads them itself at startup. The old `/etc/hermes.env`
is no longer an input. Do not edit generated copies; rebuild from SOPS instead.

For GitHub CLI, add `GH_TOKEN` inside the same `hermes-env` block. The managed
`gh` launcher reads that value at runtime and exports it only to GitHub CLI,
including when called by Hermes or an existing SSH/Zellij shell. An explicitly
supplied `GH_TOKEN` takes precedence. No `gh auth login` step is required.

### Fresh machine / replacement host

Provision `/etc/ssh/ssh_host_ed25519_key` before the first NixOS activation that
uses these secrets. Reusing the existing host identity requires restoring its
private key securely, outside Git. If the replacement has a new host key:

1. Convert its public key with `ssh-to-age` and replace the herdr recipient in
   `.sops.yaml`.
2. On the Mac, run `sops updatekeys secrets/hermes.yaml` using the personal key.
3. Commit the new recipients and ciphertext, deploy, and rebuild.

A new unrelated private key cannot decrypt secrets encrypted for the old host.
Keep `sops.useSystemdActivation = false`: this pinned Hermes module needs secrets
available during activation, before services start. See the
[sops-nix documentation](https://github.com/Mic92/sops-nix) and
[Hermes Nix setup](https://hermes-agent.nousresearch.com/docs/getting-started/nix-setup).

Log out and back in after initially adding group membership. Existing shells
and Zellij sessions retain their old groups until restarted.

## Verify

Run on herdr after rebuilding; these checks never print secret values:

```sh
sudo -u richard -H env -u HERMES_HOME python3 /etc/nixos/scripts/check-hermes.py
systemctl is-active hermes-agent
```

The check exercises Hermes' real environment loader with inherited credentials
removed, verifies the model and identity, and invokes the real sessions CLI
through the per-user launcher and verifies database ownership. API availability
requires a separate model request; these checks do not spend tokens or send a
Telegram message.

## Migration backup

The original Richard and system profiles were retained under
`/var/backups/hermes-consolidation-20260919T060737Z` (root-only). The phone
gateway inherited Richard's two conversations and preferences. The duplicate
`hermes-gateway.service` user unit is disabled.

## Headless browser

`modules/hermes-browser.nix` selects Hermes' Browser Use backend in local,
headless mode. Nix installs Chromium and agent-browser. A prerequisite systemd
unit installs Browser Use CLI 0.13.10 into `/var/lib/hermes/browser-tools` using
Nix's Python. First provision requires network access to Python package indexes;
later boots reuse the environment. Transitive Python dependencies are resolved
at installation time. No cloud browser key or public debugging port is needed.

The CLI and Telegram toolsets expose `browser_exec`. Start a new conversation
after deployment to pick up the tool definitions. Verify a real HTTPS page load
without spending model tokens:

```sh
sudo -u richard -H env -u HERMES_HOME python3 /etc/nixos/scripts/check-hermes-browser.py
sudo -u hermes -H env HERMES_HOME=/var/lib/hermes/.hermes python3 /etc/nixos/scripts/check-hermes-browser.py
```

## Login account

Richard is the sole human login. Interactive SSH opens or attaches to Zellij's
`main` session in `/code`, using Richard's existing layout and bindings. Detach
returns to Bash. Remote commands and file transfers bypass Zellij. Agent-tool
hooks are installed in Richard's home, and Richard owns `/etc/nixos` and `/code`.
The `hermes` system account continues running the phone gateway.

The retired agent home is backed up privately in
`/var/backups/agent-retirement/home-agent.tar`; its files are preserved rather
than merged over Richard's credentials and conversation state.

## Rebuild

```sh
pullrebuild   # git pull --ff-only in /etc/nixos, then nixos-rebuild switch
```
