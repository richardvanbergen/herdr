{ config, lib, pkgs, ... }:

let
  tokenPython = pkgs.python3.withPackages (ps: [ ps.python-dotenv ]);
  readGhToken = pkgs.writeScript "read-gh-token" ''
    #!${tokenPython}/bin/python3
    from dotenv import dotenv_values
    print(dotenv_values("/var/lib/hermes-config/.env").get("GH_TOKEN") or "", end="")
  '';
  ghWithToken = pkgs.writeScriptBin "gh" ''
    #!${tokenPython}/bin/python3
    import os
    import sys
    from dotenv import dotenv_values

    # Read at invocation time so existing shells also see rotated credentials.
    # Parse dotenv as data; never source secrets as executable shell code.
    if not os.environ.get("GH_TOKEN"):
        token = dotenv_values("/var/lib/hermes-config/.env").get("GH_TOKEN")
        if token:
            os.environ["GH_TOKEN"] = token
    os.execv("${pkgs.gh}/bin/gh", ["gh", *sys.argv[1:]])
  '';
in
{
  # Dev toolchain. Box stays clean: only these + services live on the host,
  # everything heavier runs through Docker.
  environment.systemPackages = [
    pkgs.git
    pkgs.bun
    pkgs.awscli
    pkgs.lazygit
    pkgs.gcc
    pkgs.ghostty.terminfo
    (lib.hiPrio ghWithToken)
  ];

  services.hermes-agent.extraPackages = [ (lib.hiPrio ghWithToken) ];

  # System Git config is rebuilt from Nix. Use the token-loading launcher,
  # rather than the raw gh binary that `gh auth setup-git` would record.
  programs.git = {
    enable = true;
    config.credential = lib.genAttrs [ "https://github.com" "https://gist.github.com" ] (_: {
      helper = [ "" "!${ghWithToken}/bin/gh auth git-credential" ];
    });
  };

  # Give the gateway its own non-secret Git credential configuration. The
  # helper delegates to ghWithToken, which reads GH_TOKEN only at invocation
  # time from the protected shared config; no credential enters the Nix store.
  systemd.services.hermes-agent.environment = {
    GIT_CONFIG_COUNT = "4";
    GIT_CONFIG_KEY_0 = "credential.https://github.com.helper";
    GIT_CONFIG_VALUE_0 = "";
    GIT_CONFIG_KEY_1 = "credential.https://github.com.helper";
    GIT_CONFIG_VALUE_1 = "!${ghWithToken}/bin/gh auth git-credential";
    GIT_CONFIG_KEY_2 = "credential.https://gist.github.com.helper";
    GIT_CONFIG_VALUE_2 = "";
    GIT_CONFIG_KEY_3 = "credential.https://gist.github.com.helper";
    GIT_CONFIG_VALUE_3 = "!${ghWithToken}/bin/gh auth git-credential";
    GIT_TERMINAL_PROMPT = "0";
  };

  # Load only this credential, as data, into new interactive/login shells.
  environment.shellInit = ''
    if { [ "$USER" = richard ] || [ "$USER" = hermes ]; } && [ -r /var/lib/hermes-config/.env ] && [ -z "''${GH_TOKEN:-}" ]; then
      export GH_TOKEN="$(${readGhToken})"
    fi
  '';

  # Docker daemon managed by systemd, declarative. Services (db, redis,
  # prod-like stacks) run as containers; dev servers run in-process.
  virtualisation.docker = {
    enable = true;
    enableOnBoot = true;
  };

  # Both operators are explicitly trusted with root-equivalent Docker access.
  users.users.richard.extraGroups = [ "docker" ];
  users.users.${config.services.hermes-agent.user}.extraGroups = [ "docker" ];
  # Declare it on the unit too so changing access restarts the gateway and
  # updates its running process credentials during nixos-rebuild switch.
  systemd.services.hermes-agent.serviceConfig.SupplementaryGroups = [ "docker" ];
}
