{ config, lib, pkgs, ... }:

let
  stateDir = "/var/lib/charon";
  compose = "${pkgs.docker-compose}/bin/docker-compose";
in
{
  # The release script writes an immutable image tag and its matching Compose
  # definition here. Nix owns the durable state directory and boot-time service.
  systemd.tmpfiles.rules = [
    "d ${stateDir} 2770 richard hermes - -"
    "d ${stateDir}/backups 2770 richard hermes - -"
  ];

  systemd.services.charon-production = {
    description = "Run the released Charon production image";
    after = [ "docker.service" "network-online.target" ];
    wants = [ "network-online.target" ];
    requires = [ "docker.service" ];
    wantedBy = [ "multi-user.target" ];
    unitConfig.ConditionPathExists = "${stateDir}/production.env";
    serviceConfig = {
      Type = "oneshot";
      WorkingDirectory = stateDir;
      ExecStart = "${compose} --project-name charon-production --env-file ${stateDir}/production.env -f ${stateDir}/production-compose.yml up -d --wait --remove-orphans";
    };
  };

  # A successful release atomically replaces production.env. Watching that
  # file lets the unprivileged release script request deployment without an
  # imperative sudo/systemctl escape hatch.
  systemd.paths.charon-production-release = {
    description = "Deploy Charon when a new release manifest is written";
    wantedBy = [ "multi-user.target" ];
    pathConfig = {
      PathChanged = "${stateDir}/production.env";
      Unit = "charon-production.service";
    };
  };
}
