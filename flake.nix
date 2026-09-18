{
  description = "herdr server";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    herdr.url = "github:herdrdev/herdr/v0.9.0";
    zj-agent-harpoon.url = "github:richardvanbergen/zj-agent-harpoon";
  };

  outputs = { self, nixpkgs, herdr, zj-agent-harpoon, ... }: {
    nixosConfigurations.herdr = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ./configuration.nix
        zj-agent-harpoon.nixosModules.default
      ];
      specialArgs = { inherit herdr zj-agent-harpoon; };
    };
  };
}
