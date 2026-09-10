{ config, pkgs, herdr, ... }:

let
  agentShell = pkgs.writeShellScriptBin "agent-shell" ''
    export SHELL=${pkgs.bash}/bin/bash
    exec ${pkgs.zellij}/bin/zellij attach -c main
  '';
in
{
  imports = [ ./hardware-configuration.nix ];

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
    pkgs.git
    pkgs.zellij
    herdr.packages.x86_64-linux.default
  ];

  environment.shells = [ "${agentShell}/bin/agent-shell" ];

  environment.loginShellInit = ''
    if [ "$USER" = agent ]; then
      mkdir -p /home/agent/code
      cd /home/agent/code
    fi
  '';

  # /etc/nixos is root-owned by default; let agent git-pull the config in place
  systemd.tmpfiles.rules = [
    "Z /etc/nixos - agent users - -"
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

  programs.zj-agent-sidebar = {
    enable = true;
    agents.enable = true;
  };

  users.users.richard = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
    openssh.authorizedKeys.keys = [ "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDcSmcw1Cbz1ynL/yO/OzjwpJUYAvKDtbaq9kWMXDfarcVjZoD4IaD9g4I7g1xzX1tXo11YyzYLxvCkHf6hdy9WZ2827NJWbp65MXQ0kgKedsmZ/7THCtAiQbGzAGsRDOpdRSl9gT/TKwmk3OotKfJSdWxQRoJBSLSDLOYjeuJjMUtWcOKn+HQOD9v9daJKiqegJmah1EvLjmsre5M3RTL4FFyeSbxTgPITcqDn3lFkVdFsTsBHDGZPCOJRwUJ3KYRHHrRBrXCleyW08hsMukU42MpMpuRRW7xVFzyQ1ciwg2RKC6m29JIpuhUtflKIpVuaBwXjpEricfX551bmlmDvUrcvVjD1GCnu+g5+JelBaOF1oIaLvNWEAVdM8Z912kuDVIyZGRU8Sf2RQgxCGU2ETJ07G3i51rfJrolByEayV9PA73RLyCswRp+hZ0+0oUCxsHu0y+Ujk3Itr+AtYJwiK1oSt7LLLYgd1zjjlON4D73dqmVdr7HRCwhJlc4l03E= richard.vanbergen@Richards-MacBook-Pro-2.local" ];
  };

  users.users.agent = {
    isNormalUser = true;
    shell = "${agentShell}/bin/agent-shell";
    openssh.authorizedKeys.keys = [ "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDcSmcw1Cbz1ynL/yO/OzjwpJUYAvKDtbaq9kWMXDfarcVjZoD4IaD9g4I7g1xzX1tXo11YyzYLxvCkHf6hdy9WZ2827NJWbp65MXQ0kgKedsmZ/7THCtAiQbGzAGsRDOpdRSl9gT/TKwmk3OotKfJSdWxQRoJBSLSDLOYjeuJjMUtWcOKn+HQOD9v9daJKiqegJmah1EvLjmsre5M3RTL4FFyeSbxTgPITcqDn3lFkVdFsTsBHDGZPCOJRwUJ3KYRHHrRBrXCleyW08hsMukU42MpMpuRRW7xVFzyQ1ciwg2RKC6m29JIpuhUtflKIpVuaBwXjpEricfX551bmlmDvUrcvVjD1GCnu+g5+JelBaOF1oIaLvNWEAVdM8Z912kuDVIyZGRU8Sf2RQgxCGU2ETJ07G3i51rfJrolByEayV9PA73RLyCswRp+hZ0+0oUCxsHu0y+Ujk3Itr+AtYJwiK1oSt7LLLYgd1zjjlON4D73dqmVdr7HRCwhJlc4l03E= richard.vanbergen@Richards-MacBook-Pro-2.local" ];
  };

  system.stateVersion = "26.05";
}
