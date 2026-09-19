# herdr

NixOS flake for the `herdr` box. Everything is declarative except the
handful of secrets below — those can't go through the Nix store (it's
world-readable), so they're deliberately left as manual, one-time steps.

## Manual setup (fresh box, or after adding a new secret)

- **Hermes Agent's model API key** — create `/etc/hermes.env` (root-only,
  `chmod 600`) with:
  ```
  OPENCODE_GO_API_KEY=<your key>
  ```
  `services.hermes-agent` (`modules/hermes-agent.nix`) reads this via
  `environmentFiles`; nothing else about the service needs touching. To use
  a different provider or model, see the provider table at
  [hermes-agent's docs](https://hermes-agent.nousresearch.com/docs/integrations/providers)
  and change the env var name + `modules/hermes-agent.nix`'s `settings.model`
  to match.

## Rebuild

```
pullrebuild   # alias: git -C /etc/nixos pull --ff-only && sudo nixos-rebuild switch --refresh
```
