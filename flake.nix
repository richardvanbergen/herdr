{
  description = "herdr server";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    herdr.url = "github:herdrdev/herdr/v0.9.0";
    zj-agent-sidebar.url = "github:richardvanbergen/zj-agent-sidebar";
  };

  outputs = { self, nixpkgs, herdr, zj-agent-sidebar, ... }: {
    nixosConfigurations.herdr = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ./configuration.nix
        zj-agent-sidebar.nixosModules.default
      ];
      specialArgs = { inherit herdr zj-agent-sidebar; };
    };
  };
}
