# herdr

NixOS flake for the `herdr` box. Hermes runs as one system service, with
`richard` and `agent` sharing its configuration, sessions, and identity.

## Hermes and Marvin

`modules/hermes-agent.nix` declares the provider and model. The initial choice
matches the working phone setup: OpenCode Go / `mimo-v2.5`.

Edit `hermes/SOUL.md` here and rebuild to update Marvin's identity. Nix installs
it at `/var/lib/hermes/.hermes/SOUL.md`. Both users' `~/.hermes` paths symlink
to that shared directory, and both belong to the `hermes` group. Existing
per-user directories are backed up as `~/.hermes.before-shared.<timestamp>`;
their contents are not automatically merged. Changes to the deployed soul are
overwritten on rebuild; memories and sessions remain mutable.

Use `hermes` directly after deployment. Do not run `hermes setup` or
`hermes gateway install`: the NixOS module owns setup and the gateway lifecycle.
The phone gateway is `hermes-agent.service`, running as `hermes`.

## Secrets and the first session

The model key is **`OPENCODE_GO_API_KEY`**. SOPS is a secrets manager, not the
name of an API key. This flake does not currently configure SOPS or agenix.
It reads a root-owned `/etc/hermes.env` outside the repository and Nix store.

On a fresh machine, provision this file **before the first rebuild/start**:

```sh
sudo touch /etc/hermes.env
sudo chown root:root /etc/hermes.env
sudo chmod 600 /etc/hermes.env
sudoedit /etc/hermes.env
```

Supply the real values in that editor, never in Git or a shell command:

```dotenv
OPENCODE_GO_API_KEY=<provider key>
TELEGRAM_BOT_TOKEN=<bot token>
TELEGRAM_ALLOWED_USERS=<your Telegram user ID>
TELEGRAM_HOME_CHANNEL=<your Telegram chat ID>
```

Then run:

```sh
sudo nixos-rebuild switch --flake /etc/nixos#herdr
sudo systemctl restart hermes-agent
```

Repeat these two commands after editing secrets. Upstream copies
`environmentFiles` into `/var/lib/hermes/.hermes/.env` **during activation**;
editing `/etc/hermes.env` or restarting alone does not refresh that copy.
The restart ensures the running gateway sees the refreshed credentials even
when a secret-only change leaves its systemd unit unchanged.
Missing source files only produce an upstream warning, so a successful rebuild
alone is not evidence that authentication is configured.

The runtime `.env` is readable by the `hermes` group (including both operators),
not by other users. Plaintext secrets never pass through Nix expressions.
For fully automated machine provisioning, provision `/etc/hermes.env` securely
before activation, or add sops-nix/agenix and point `environmentFiles` at its
decrypted runtime path. The decryption identity must also be provisioned outside
Git. See the [upstream Nix setup documentation](https://hermes-agent.nousresearch.com/docs/getting-started/nix-setup).

Log out and back in after initially adding group membership. Existing shells
and Zellij sessions retain their old groups until restarted.

## Verify

Run on herdr after rebuilding; these checks never print secret values:

```sh
for user in richard agent; do
  sudo -u "$user" -H env HERMES_HOME=/var/lib/hermes/.hermes python3 /etc/nixos/scripts/check-hermes.py
  sudo -u "$user" -H env -u HERMES_HOME python3 /etc/nixos/scripts/check-hermes.py
done
systemctl is-active hermes-agent
```

The check exercises Hermes' real environment loader with inherited credentials
removed, verifies the model and identity, and opens the shared session database
for a rolled-back write transaction. API availability requires a separate model
request; these checks do not spend tokens or send a Telegram message.

## Rebuild

```sh
pullrebuild   # git pull --ff-only in /etc/nixos, then nixos-rebuild switch
```
