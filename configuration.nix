{
  imports = [ ./hardware-configuration.nix ];

  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  networking.hostName = "herdr";
  services.openssh.enable = "true";

  users.users.richard = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
  };
}
