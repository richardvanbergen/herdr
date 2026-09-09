{
  imports = [ ./hardware-configuration.nix ];

  boot.loader.grub.enable = true;
  boot.loader.grub.device = "/dev/vda";

  services = {
    openssh.enable = true;
    tailscale.enable = true;
  };

  environment.systemPackages = [ pkgs.git ];

  nix = {
    settings = {
      experimental-features = [ "nix-command", "flakes" ];
    };
  };

  networking = {
    hostName = "herdr";
    firewall = {
      trustedInterfaces = [ "tailscale0" ];
      allowedUDPPorts = [ config.services.tailscale.port ];
    };
  };

  users.users.richard = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
    openssh.authorizedKeys.keys = [ "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDcSmcw1Cbz1ynL/yO/OzjwpJUYAvKDtbaq9kWMXDfarcVjZoD4IaD9g4I7g1xzX1tXo11YyzYLxvCkHf6hdy9WZ2827NJWbp65MXQ0kgKedsmZ/7THCtAiQbGzAGsRDOpdRSl9gT/TKwmk3OotKfJSdWxQRoJBSLSDLOYjeuJjMUtWcOKn+HQOD9v9daJKiqegJmah1EvLjmsre5M3RTL4FFyeSbxTgPITcqDn3lFkVdFsTsBHDGZPCOJRwUJ3KYRHHrRBrXCleyW08hsMukU42MpMpuRRW7xVFzyQ1ciwg2RKC6m29JIpuhUtflKIpVuaBwXjpEricfX551bmlmDvUrcvVjD1GCnu+g5+JelBaOF1oIaLvNWEAVdM8Z912kuDVIyZGRU8Sf2RQgxCGU2ETJ07G3i51rfJrolByEayV9PA73RLyCswRp+hZ0+0oUCxsHu0y+Ujk3Itr+AtYJwiK1oSt7LLLYgd1zjjlON4D73dqmVdr7HRCwhJlc4l03E= richard.vanbergen@Richards-MacBook-Pro-2.local" ];
  };
}
