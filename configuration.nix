{ config, pkgs, herdr, zj-agent-sidebar, ... }:

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
      cd /home/agent/Code
    fi
  '';

  # /etc/nixos is root-owned by default; agent + richard both maintain the
  # config here. Ownership fix + default ACL so future git writes stay
  # writable by both users regardless of umask. Z applies its mode to files
  # too, so group-write self-healing uses default ACLs instead of 2775.
  #
  # The L+ rules wire agent's per-user pieces (never touched by the module
  # itself, per zj-agent-sidebar's "manual on purpose" rule):
  # - plugins/ symlinked to the store's prebuilt wasm pair
  # - ~/Code/zj-agent-state symlinked to the pinned repo source, so hook
  #   scripts exist at the path INSTALL.md + the hooks expect (read-only)
  systemd.tmpfiles.rules = [
    "Z /etc/nixos - agent users - -"
    "a+ /etc/nixos - - - - default:user:agent:rwx,default:group:users:rwx"
    "d /home/agent/Code 0755 agent users - -"
    "L+ /home/agent/.config/zellij/plugins/zj-agent-state-watcher.wasm - - - - ${config.programs.zj-agent-sidebar.package}/lib/zellij/zj-agent-state-watcher.wasm"
    "L+ /home/agent/.config/zellij/plugins/zj-agent-state-sidebar.wasm - - - - ${config.programs.zj-agent-sidebar.package}/lib/zellij/zj-agent-state-sidebar.wasm"
    "L+ /home/agent/Code/zj-agent-state - - - - ${zj-agent-sidebar.packages.x86_64-linux.wasmPlugins.src}"
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

  environment.shellAliases = {
    rebuild = "nixos-rebuild switch --refresh";
  };

  system.stateVersion = "26.05";
}
