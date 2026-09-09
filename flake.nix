{
  description = "herdr server";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    herdr.url = "github:herdrdev/herdr/v0.9.0";
  };

  outputs = { self, nixpkgs, herdr, ... }: {
    nixosConfigurations.herdr = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [ ./configuration.nix ];
      specialArgs = { inherit herdr; };
    };
  };
}
