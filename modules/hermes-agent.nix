{ config, lib, pkgs, ... }:

let
  cfg = config.services.hermes-agent;
  hermesHome = "${cfg.stateDir}/.hermes";
  sharedInputs = "/var/lib/hermes-config";
  operators = [ "richard" ];
  # Managed homes do not scaffold themselves. Match this pin's config_home
  # requirements, including directories the upstream Nix module omits.
  stateSubdirs = [
    "cron" "sessions" "logs" "logs/curator" "memories" "pairing"
    "hooks" "image_cache" "audio_cache" "skills" "plugins" "bin"
  ];
  hermesPackage = if cfg.extraPythonPackages == [ ] && cfg.extraDependencyGroups == [ ]
    then cfg.package
    else cfg.package.override { inherit (cfg) extraPythonPackages extraDependencyGroups; };
  operatorCli = pkgs.writeShellScriptBin "hermes" ''
    # Override stale exports in pre-rebuild shells as well as new logins.
    export HERMES_HOME="$HOME/.hermes"
    exec ${hermesPackage}/bin/hermes "$@"
  '';
in
{
  imports = [ ./hermes-browser.nix ];

  # ProtectSystem=strict otherwise makes /code read-only inside the gateway.
  systemd.services.hermes-agent.serviceConfig.ReadWritePaths = [ "/code" ];

  sops = {
    defaultSopsFile = ../secrets/hermes.yaml;
    age.sshKeyPaths = [ "/etc/ssh/ssh_host_ed25519_key" ];
    gnupg.sshKeyPaths = [ ];
    # Hermes copies environmentFiles during activation, after setupSecrets.
    useSystemdActivation = false;
    secrets.hermes-env = {
      mode = "0400";
      restartUnits = [ "hermes-agent.service" ];
    };
  };

  # Native systemd service (no container.enable) — matches how everything
  # else on this box runs; module defaults create the `hermes` system user
  # and /var/lib/hermes state dir automatically.
  services.hermes-agent = {
    enable = true;

    settings.model = {
      default = "gpt-5.6-terra";
      provider = "openai-codex";
      base_url = "https://chatgpt.com/backend-api/codex";
      api_mode = "codex_responses";
    };
    settings.agent.reasoning_effort = "high";

    environmentFiles = [ config.sops.secrets.hermes-env.path ];

    hermesHomeFiles."SOUL.md" = ../hermes/SOUL.md;

    # The upstream global HERMES_HOME export also shares owner-only SQLite
    # databases. Provision per-user state with shared inputs below instead.
    addToSystemPackages = false;
  };

  # Upstream only grants hostUsers access in container mode. Native mode
  # needs explicit membership to read the shared configuration and secrets.
  users.users = lib.genAttrs operators (_: { extraGroups = [ cfg.group ]; });

  # Hermes enforces 0600 on its SQLite database and sidecars at runtime.
  # Keep each caller's state separate; only model, identity and secrets are shared.
  environment.systemPackages = [ hermesPackage (lib.hiPrio operatorCli) ];

  system.activationScripts.hermes-user-homes = lib.stringAfter [ "hermes-agent-setup" ] (
    ''
      # Hermes may chmod its private profile to 0700 while saving auth state.
      # Keep operator inputs outside that runtime-owned directory.
      install -d -m 0750 -o root -g ${cfg.group} ${sharedInputs}
      install -m 0640 -o root -g ${cfg.group} ${hermesHome}/.env ${sharedInputs}/.env
      for file in config.yaml SOUL.md .managed; do
        cp -L ${hermesHome}/$file ${sharedInputs}/$file
        chown root:${cfg.group} ${sharedInputs}/$file
        chmod 0640 ${sharedInputs}/$file
      done
      for dir in ${lib.concatStringsSep " " stateSubdirs}; do
        install -d -m 2770 -o ${cfg.user} -g ${cfg.group} "${hermesHome}/$dir"
      done
    '' + lib.concatMapStringsSep "\n" (user:
      let
        home = config.users.users.${user}.home;
        group = config.users.users.${user}.group;
      in ''
        if [ -L "${home}/.hermes" ]; then
          mv "${home}/.hermes" "${home}/.hermes.before-local.$(date +%s%N)"
        fi
        install -d -m 0700 -o ${user} -g ${group} "${home}/.hermes"
        for dir in ${lib.concatStringsSep " " stateSubdirs}; do
          install -d -m 0700 -o ${user} -g ${group} "${home}/.hermes/$dir"
        done
        for file in .env config.yaml SOUL.md .managed; do
          if [ -e "${home}/.hermes/$file" ] && [ ! -L "${home}/.hermes/$file" ]; then
            mv "${home}/.hermes/$file" "${home}/.hermes/$file.before-nix.$(date +%s%N)"
          fi
          ln -sfn "${sharedInputs}/$file" "${home}/.hermes/$file"
          chown -h ${user}:${group} "${home}/.hermes/$file"
        done
      ''
    ) operators
  );
}
