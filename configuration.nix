{ config, pkgs, herdr, zj-agent-sidebar, ... }:

{
  imports = [
    ./hardware-configuration.nix
    ./modules/dev-tools.nix
    ./modules/agent-env.nix
    ./modules/nvim.nix
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

  # /etc/nixos maintained by richard + agent via git. Ownership Z rule +
  # recursive access ACL (A+) give the users group write on everything —
  # both users edit through the group, regardless of which owns a file.
  # Default ACL on the root dir self-heals newly git-written files (git's
  # core.sharedRepository=group also requests group-write, the two agree).
  # Avoid "Z ... 2775": its mode recurses onto plain files (setgid/exec
  # churn in git).
  systemd.tmpfiles.rules = [
    "Z /etc/nixos - agent users - -"
    "A+ /etc/nixos - - - - group:users:rwX"
    "a+ /etc/nixos - - - - default:group:users:rwx"
  ];

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
    # Pull latest config into /etc/nixos, then rebuild — both users can run it
    pullrebuild = "git -C /etc/nixos pull --ff-only && sudo nixos-rebuild switch --refresh";
  };

  system.stateVersion = "26.05";
}
