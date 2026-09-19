{ config, pkgs, herdr, zj-agent-harpoon, ... }:

{
  imports = [
    ./hardware-configuration.nix
    ./modules/dev-tools.nix
    ./modules/agent-env.nix
    ./modules/nvim.nix
    ./modules/zellij.nix
    ./modules/hermes-agent.nix
    ./modules/tailscale-serve.nix
  ];

  boot.loader.grub.enable = true;
  boot.loader.grub.devices = [ "/dev/vda" ];

  services = {
    openssh = {
      enable = true;
      openFirewall = false;
    };
    tailscale.enable = true;
  };

  environment.systemPackages = [
    pkgs.zellij
    pkgs.jq
    pkgs.python3
    herdr.packages.x86_64-linux.default
  ];

  # Richard owns the checkout; no cross-account write permissions are needed.
  systemd.tmpfiles.rules = [
    "Z /etc/nixos - richard users - -"
    "d /etc/nixos 0700 richard users - -"
  ];

  system.activationScripts.workspace-permissions = {
    deps = [ "users" ];
    text = ''
      ${pkgs.coreutils}/bin/install -d -m 2770 -o richard -g hermes /code
      # Fix existing files without following links outside the workspace.
      ${pkgs.acl}/bin/setfacl -R -P -m g:hermes:rwX,m::rwX /code
      # Inherit shared access in new files/directories, including existing repos.
      ${pkgs.findutils}/bin/find /code -xdev -type d -exec \
        ${pkgs.acl}/bin/setfacl -m d:g:hermes:rwx,d:m::rwx {} +
      # Retire the former shared-account ACLs at the private checkout boundary.
      ${pkgs.acl}/bin/setfacl -b -k /etc/nixos
      ${pkgs.coreutils}/bin/chown richard:users /etc/nixos
      ${pkgs.coreutils}/bin/chmod 0700 /etc/nixos
    '';
  };

  nix = {
    settings = {
      experimental-features = [ "nix-command" "flakes" ];
    };
  };

  networking = {
    hostName = "herdr";
    firewall = {
      trustedInterfaces = [ "tailscale0" ];
      allowedUDPPorts = [ config.services.tailscale.port ];
    };
  };

  security.sudo.wheelNeedsPassword = false;

  nixpkgs.config.allowUnfreePredicate =
    pkg: builtins.elem (pkgs.lib.getName pkg) [ "claude-code" ];

  users.users.richard = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
    openssh.authorizedKeys.keys = [ "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDcSmcw1Cbz1ynL/yO/OzjwpJUYAvKDtbaq9kWMXDfarcVjZoD4IaD9g4I7g1xzX1tXo11YyzYLxvCkHf6hdy9WZ2827NJWbp65MXQ0kgKedsmZ/7THCtAiQbGzAGsRDOpdRSl9gT/TKwmk3OotKfJSdWxQRoJBSLSDLOYjeuJjMUtWcOKn+HQOD9v9daJKiqegJmah1EvLjmsre5M3RTL4FFyeSbxTgPITcqDn3lFkVdFsTsBHDGZPCOJRwUJ3KYRHHrRBrXCleyW08hsMukU42MpMpuRRW7xVFzyQ1ciwg2RKC6m29JIpuhUtflKIpVuaBwXjpEricfX551bmlmDvUrcvVjD1GCnu+g5+JelBaOF1oIaLvNWEAVdM8Z912kuDVIyZGRU8Sf2RQgxCGU2ETJ07G3i51rfJrolByEayV9PA73RLyCswRp+hZ0+0oUCxsHu0y+Ujk3Itr+AtYJwiK1oSt7LLLYgd1zjjlON4D73dqmVdr7HRCwhJlc4l03E= richard.vanbergen@Richards-MacBook-Pro-2.local" ];
  };

  environment.variables.EDITOR = "nvim";

  environment.shellAliases = {
    rebuild = "sudo nixos-rebuild switch --refresh";
    # Pull latest config into /etc/nixos, then rebuild
    pullrebuild = "git -C /etc/nixos pull --ff-only && sudo nixos-rebuild switch --refresh";
  };

  system.stateVersion = "26.05";
}
