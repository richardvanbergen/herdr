{ config, lib, pkgs, ... }:

let
  tokenPython = pkgs.python3.withPackages (ps: [ ps.python-dotenv ]);
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
    (lib.hiPrio ghWithToken)
  ];

  services.hermes-agent.extraPackages = [ (lib.hiPrio ghWithToken) ];

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
