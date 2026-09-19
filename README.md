# herdr

NixOS flake for the `herdr` box. Everything is declarative except the
handful of secrets below — those can't go through the Nix store (it's
world-readable), so they're deliberately left as manual, one-time steps.

## Manual setup (fresh box, or after adding a new secret)

- **Hermes Agent's model API key** — an empty template already exists at
  `/etc/hermes.env` on the box (root-only, `chmod 600`). Edit it with
  `sudo` and fill in the value:
  ```
  sudo nano /etc/hermes.env
  ```
  ```
  # Hermes Agent secrets. Root-only — never commit this file anywhere.
  # See README.md at the herdr repo root for the provider/model this pairs with.
  OPENCODE_GO_API_KEY=<your key>
  ```
  `services.hermes-agent` (`modules/hermes-agent.nix`) reads this via
  `environmentFiles`; nothing else about the service needs touching. On a
  fresh box this file won't exist yet — recreate it the same way (`sudo`,
  `chmod 600`, `chown root:root`) before or after the first rebuild, order
  doesn't matter: NixOS's activation script merges it into Hermes's real
  `.env` on every switch, and just logs a warning and continues if the file
  is missing rather than failing the rebuild. To use a different provider
  or model, see the provider table at
  [hermes-agent's docs](https://hermes-agent.nousresearch.com/docs/integrations/providers)
  and change the env var name + `modules/hermes-agent.nix`'s `settings.model`
  to match.

## Rebuild

```
pullrebuild   # alias: git -C /etc/nixos pull --ff-only && sudo nixos-rebuild switch --refresh
```
