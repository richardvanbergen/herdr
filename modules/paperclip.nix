{ config, lib, pkgs, ... }:

let
  cfg = config.services.paperclip;
  package = pkgs.callPackage ../packages/paperclip { };
  stateDir = "/var/lib/paperclip";
  start = pkgs.writeShellScript "paperclip-start" ''
    # Permit the short MagicDNS name and this node's full tailnet name.
    tailnet_name="$(${pkgs.tailscale}/bin/tailscale status --json | ${pkgs.jq}/bin/jq -r '.Self.DNSName // ""' | ${pkgs.coreutils}/bin/tr -d '\n')"
    export PAPERCLIP_ALLOWED_HOSTNAMES="herdr,localhost,127.0.0.1,''${tailnet_name%.}"
    exec ${package}/bin/paperclip-server
  '';
in
{
  options.services.paperclip.enable = lib.mkEnableOption "Paperclip on herdr";

  config = lib.mkIf cfg.enable {
    environment.systemPackages = [ package pkgs.nodejs_24 ];

    # Native PostgreSQL: database, owner, peer mapping and backups all belong
    # to NixOS. No embedded database, Docker database or plaintext DB password.
    services.postgresql = {
      enable = true;
      package = pkgs.postgresql_17;
      enableTCPIP = false;
      ensureDatabases = [ "paperclip" ];
      ensureUsers = [{ name = "paperclip"; ensureDBOwnership = true; }];
      authentication = lib.mkBefore ''
        local paperclip paperclip peer map=paperclip
      '';
      identMap = ''
        paperclip richard paperclip
      '';
    };
    services.postgresqlBackup = {
      enable = true;
      databases = [ "paperclip" ];
      startAt = "*-*-* 03:15:00";
    };

    systemd.tmpfiles.rules = [
      "d ${stateDir} 0700 richard users - -"
    ];

    systemd.services.paperclip-secrets = {
      description = "Provision persistent Paperclip secrets";
      before = [ "paperclip.service" ];
      serviceConfig.Type = "oneshot";
      script = ''
        set -eu
        if [ ! -e ${stateDir}/runtime.env ]; then
          umask 077
          ${pkgs.python3}/bin/python3 - <<'PY'
        import os, secrets
        path = "${stateDir}/runtime.env"
        with open(path + ".tmp", "w") as f:
            for key in ("BETTER_AUTH_SECRET", "PAPERCLIP_AGENT_JWT_SECRET", "PAPERCLIP_SECRETS_MASTER_KEY"):
                f.write(key + "=" + secrets.token_hex(32) + "\n")
        os.replace(path + ".tmp", path)
        PY
        fi
      '';
    };

    # Keep the old bind-mounted app and bridge disconnected across reboots.
    # Retain containers, volumes and all Charon data for rollback.
    systemd.services.charon-retire = {
      description = "Disconnect Charon while Paperclip owns the web endpoint";
      wantedBy = [ "multi-user.target" ];
      after = [ "docker.service" ];
      requires = [ "docker.service" ];
      before = [ "nginx.service" ];
      path = [ pkgs.docker pkgs.systemd pkgs.util-linux pkgs.coreutils ];
      serviceConfig = { Type = "oneshot"; RemainAfterExit = true; };
      script = ''
        set -eu
        for container in $(docker ps -aq --filter label=com.docker.compose.project=charon --filter label=com.docker.compose.service=charon) \
                         $(docker ps -aq --filter label=com.docker.compose.project=charon-production); do
          docker update --restart=no "$container"
          docker stop "$container"
        done
        # Ensure disable persists even when no SSH login has started the user
        # manager yet (for example during an unattended boot).
        systemctl start "user@$(id -u richard).service"
        runtime_dir="/run/user/$(id -u richard)"
        if [ -S "$runtime_dir/bus" ]; then
          if runuser -u richard -- env XDG_RUNTIME_DIR="$runtime_dir" systemctl --user cat charon-hermes.service >/dev/null 2>&1; then
            runuser -u richard -- env XDG_RUNTIME_DIR="$runtime_dir" systemctl --user disable --now charon-hermes.service
          fi
        fi
      '';
    };

    systemd.services.paperclip = {
      description = "Paperclip agent orchestration";
      wantedBy = [ "multi-user.target" ];
      after = [ "network-online.target" "postgresql.service" "postgresql-setup.service" "paperclip-secrets.service" "tailscaled.service" "charon-retire.service" ];
      wants = [ "network-online.target" "tailscaled.service" ];
      requires = [ "postgresql.service" "postgresql-setup.service" "paperclip-secrets.service" "charon-retire.service" ];
      # Use Richard's existing CLI login and per-user Hermes profile. The
      # Telegram gateway retains its separate Hermes-owned profile.
      path = [ pkgs.nodejs_24 pkgs.git pkgs.bash pkgs.coreutils pkgs.ripgrep pkgs.python3 pkgs.postgresql_17 "/run/current-system/sw" ];
      environment = {
        HOME = "/home/richard";
        NODE_ENV = "production";
        PAPERCLIP_HOME = stateDir;
        PAPERCLIP_INSTANCE_ID = "default";
        PAPERCLIP_BIND = "loopback";
        HOST = "127.0.0.1";
        PORT = "3100";
        SERVE_UI = "true";
        PAPERCLIP_DEPLOYMENT_MODE = "authenticated";
        PAPERCLIP_DEPLOYMENT_EXPOSURE = "private";
        PAPERCLIP_AUTH_BASE_URL_MODE = "auto";
        # postgres.js takes socket configuration from PGHOST, not libpq's
        # ?host= URL parameter. Leave the URL host empty so PGHOST wins.
        DATABASE_URL = "postgresql:///paperclip";
        PGHOST = "/run/postgresql";
        PGUSER = "paperclip";
        PAPERCLIP_MIGRATION_AUTO_APPLY = "true";
        PAPERCLIP_MIGRATION_PROMPT = "never";
        # NixOS owns the backup schedule.
        PAPERCLIP_DB_BACKUP_ENABLED = "false";
      };
      serviceConfig = {
        User = "richard";
        Group = "users";
        WorkingDirectory = stateDir;
        EnvironmentFile = "${stateDir}/runtime.env";
        ExecStart = start;
        Restart = "on-failure";
        RestartSec = 5;
        TimeoutStopSec = 60;
        UMask = "0077";
      };
    };

    services.nginx = {
      enable = true;
      recommendedProxySettings = true;
      virtualHosts.paperclip = {
        default = true;
        serverName = "herdr";
        listen = [{ addr = "0.0.0.0"; port = 80; } { addr = "[::]"; port = 80; }];
        locations."/" = {
          proxyPass = "http://127.0.0.1:3100";
          proxyWebsockets = true;
          extraConfig = ''
            proxy_buffering off;
            proxy_read_timeout 3600s;
            client_max_body_size 100m;
          '';
        };
      };
    };
    systemd.services.nginx = {
      after = [ "charon-retire.service" "paperclip.service" ];
      requires = [ "charon-retire.service" ];
    };
    # Port 80 is reachable through the already-trusted tailscale0 interface.
    # Do not open it on the public interface.
  };
}
