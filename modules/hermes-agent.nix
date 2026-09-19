{ config, lib, ... }:

let
  cfg = config.services.hermes-agent;
  hermesHome = "${cfg.stateDir}/.hermes";
  operators = [ "richard" "agent" ];
in
{
  # Native systemd service (no container.enable) — matches how everything
  # else on this box runs; module defaults create the `hermes` system user
  # and /var/lib/hermes state dir automatically.
  services.hermes-agent = {
    enable = true;

    settings.model = {
      # Preserve the model selected in the working Telegram setup.
      default = "mimo-v2.5";
      provider = "opencode-go";
      base_url = "https://opencode.ai/zen/go/v1";
      api_mode = "chat_completions";
    };

    # The one manual step, deliberately not declared here: create
    # /etc/hermes.env (root-only) with OPENCODE_GO_API_KEY=... — see
    # README.md. Never put a real key in this repo.
    environmentFiles = [ "/etc/hermes.env" ];

    hermesHomeFiles."SOUL.md" = ../hermes/SOUL.md;

    # Puts the `hermes` CLI on PATH and exports HERMES_HOME system-wide, so
    # an interactive shell (richard, agent) shares session/config state with
    # the gateway service instead of each `hermes` invocation creating its
    # own disconnected instance under the caller's own home dir.
    addToSystemPackages = true;
  };

  # Upstream only grants hostUsers access in container mode. Native mode
  # needs explicit membership, even with addToSystemPackages enabled.
  users.users = lib.genAttrs operators (_: { extraGroups = [ cfg.group ]; });

  # Keep the conventional path working in existing shells too, where the
  # system-wide HERMES_HOME export may not have been loaded yet.
  system.activationScripts.hermes-user-homes = lib.stringAfter [ "hermes-agent-setup" ] (
    lib.concatMapStringsSep "\n" (user:
      let home = config.users.users.${user}.home;
      in ''
        if [ -e "${home}/.hermes" ] && [ ! -L "${home}/.hermes" ]; then
          mv "${home}/.hermes" "${home}/.hermes.before-shared.$(date +%s%N)"
        fi
        ln -sfn "${hermesHome}" "${home}/.hermes"
        chown -h ${user}:${cfg.group} "${home}/.hermes"
      ''
    ) operators
  );
}
