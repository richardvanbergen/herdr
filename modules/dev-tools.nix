{ config, pkgs, ... }:

{
  # Dev toolchain. Box stays clean: only these + services live on the host,
  # everything heavier runs through Docker.
  environment.systemPackages = [
    pkgs.git
    pkgs.bun
    pkgs.awscli
  ];

  # Docker daemon managed by systemd, declarative. Services (db, redis,
  # prod-like stacks) run as containers; dev servers run in-process.
  virtualisation.docker = {
    enable = true;
    enableOnBoot = true;
  };

  # Docker group == root-equivalent on the daemon. Fine here: single-purpose
  # box, both users already trusted.
  users.users.richard.extraGroups = [ "docker" ];
  users.users.agent.extraGroups = [ "docker" ];
}
