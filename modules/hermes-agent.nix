{ config, pkgs, ... }:

{
  # Native systemd service (no container.enable) — matches how everything
  # else on this box runs; module defaults create the `hermes` system user
  # and /var/lib/hermes state dir automatically.
  services.hermes-agent = {
    enable = true;

    settings.model = {
      # OpenCode Go: a subscription-based reseller that serves most model
      # families under one relay (opencode.ai/zen/go) — see its catalog in
      # hermes_cli/models_catalog_static.py upstream. gpt-5.6-luna picked as
      # a GPT-family default; swap this one line for anything else in that
      # catalog.
      default = "gpt-5.6-luna";
      provider = "opencode-go";
    };

    # The one manual step, deliberately not declared here: create
    # /etc/hermes.env (root-only) with OPENCODE_GO_API_KEY=... — see
    # README.md. Never put a real key in this repo.
    environmentFiles = [ "/etc/hermes.env" ];

    # Puts the `hermes` CLI on PATH and exports HERMES_HOME system-wide, so
    # an interactive shell (richard, agent) shares session/config state with
    # the gateway service instead of each `hermes` invocation creating its
    # own disconnected instance under the caller's own home dir.
    addToSystemPackages = true;
  };
}
