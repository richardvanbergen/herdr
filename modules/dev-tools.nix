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

  # Load only this credential, as data, into new interactive/login shells.
  environment.shellInit = ''
    if [ "$USER" = richard ] && [ -r /var/lib/hermes-config/.env ] && [ -z "''${GH_TOKEN:-}" ]; then
      export GH_TOKEN="$(${readGhToken})"
    fi
  '';

  # Docker daemon managed by systemd, declarative. Services (db, redis,
  # prod-like stacks) run as containers; dev servers run in-process.
  virtualisation.docker = {
    enable = true;
    enableOnBoot = true;
  };

  # Docker group == root-equivalent on the daemon. Fine here: single-purpose
  # box, both users already trusted.
  users.users.richard.extraGroups = [ "docker" ];
}
