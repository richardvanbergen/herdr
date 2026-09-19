{ config, pkgs, ... }:

let
  cfg = config.services.hermes-agent;
  toolDir = "${cfg.stateDir}/browser-tools";
  # Match the Browser Use CLI already used by this Hermes pin. Nixpkgs has
  # Chromium and agent-browser, but does not package this Python CLI.
  browserUseVersion = "0.13.10";
  runtimeSpec = pkgs.writeText "hermes-browser-runtime" ''
    ${pkgs.python313}
    browser-use==${browserUseVersion}
  '';
  browserUse = pkgs.writeShellScriptBin "browser-use" ''
    exec ${toolDir}/browser-use/bin/browser-use "$@"
  '';
  browserPackages = [ pkgs.chromium pkgs.agent-browser browserUse ];
in
{
  services.hermes-agent = {
    settings.browser = {
      backend = "browser-use";
      cloud_provider = "local";
      headed = false;
    };
    # Non-secret: merged with the SOPS environment for the gateway and CLIs.
    environment.AGENT_BROWSER_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";
    extraPackages = browserPackages;
  };

  environment.systemPackages = browserPackages;

  # Bootstrap the pinned Python CLI on first boot, then reuse it offline on
  # subsequent boots. An interpreter/version change recreates the environment.
  systemd.services.hermes-browser-setup = {
    description = "Provision the Hermes Browser Use CLI";
    wants = [ "network-online.target" ];
    after = [ "network-online.target" ];
    before = [ "hermes-agent.service" ];
    path = [ pkgs.uv pkgs.coreutils ];
    environment = {
      HOME = cfg.stateDir;
      UV_TOOL_DIR = toolDir;
      UV_TOOL_BIN_DIR = "${toolDir}/bin";
      UV_CACHE_DIR = "${toolDir}/cache";
      UV_NO_CONFIG = "1";
      UV_PYTHON_DOWNLOADS = "never";
    };
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
      User = cfg.user;
      Group = cfg.group;
      UMask = "0027";
      StateDirectory = "hermes/browser-tools";
      StateDirectoryMode = "0750";
      TimeoutStartSec = 600;
    };
    script = ''
      if ! cmp -s ${runtimeSpec} ${toolDir}/.runtime \
        || [ ! -x ${toolDir}/browser-use/bin/browser-use ]; then
        uv tool install --reinstall --python ${pkgs.python313}/bin/python3 \
          'browser-use==${browserUseVersion}'
        cp ${runtimeSpec} ${toolDir}/.runtime
      fi
      ${toolDir}/browser-use/bin/browser-use --help >/dev/null
    '';
  };

  systemd.services.hermes-agent = {
    requires = [ "hermes-browser-setup.service" ];
    after = [ "hermes-browser-setup.service" ];
  };

  # Hermes prefers its managed bin directory over PATH. Point both
  # accounts at the same declared launcher, replacing the old hand-installed
  # links without sharing browser profiles or cookies between accounts.
  systemd.tmpfiles.rules = map (user:
    let home = if user == cfg.user then cfg.stateDir else config.users.users.${user}.home;
    in "L+ ${home}/.hermes/bin/browser-use - ${user} ${cfg.group} - ${browserUse}/bin/browser-use"
  ) [ cfg.user "richard" ];
}
