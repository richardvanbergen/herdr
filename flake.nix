{
  description = "herdr server";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    herdr.url = "github:herdrdev/herdr/v0.9.0";
    zj-agent-harpoon.url = "github:richardvanbergen/zj-agent-harpoon";

    # Two personal Zellij plugins richard's local config depends on
    # (Ctrl-y file-jump, and the zjstatus status bar). Neither is in
    # nixpkgs. harpoon has no flake of its own, so we build it the same
    # way zj-agent-harpoon builds its own wasm plugins below; zjstatus
    # ships its own flake, so we just consume its `packages.default`.
    harpoon = {
      url = "github:Nacho114/harpoon";
      flake = false;
    };
    zjstatus.url = "github:dj95/zjstatus";

    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, herdr, zj-agent-harpoon, harpoon, zjstatus, rust-overlay, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        overlays = [ rust-overlay.overlays.default ];
      };

      # Stock nixpkgs rustc has no wasm32-wasip1 std, same reason
      # zj-agent-harpoon's own flake pins a toolchain for its plugin builds.
      rustWasmToolchain = pkgs.rust-bin.stable.latest.default.override {
        targets = [ "wasm32-wasip1" ];
      };
      rustWasmPlatform = pkgs.makeRustPlatform {
        cargo = rustWasmToolchain;
        rustc = rustWasmToolchain;
      };

      # harpoon has no flake and no nixpkgs package; build its wasm plugin
      # ourselves, same shape as zj-agent-harpoon's own wasmPlugins
      # derivation. Its own .cargo/config.toml already defaults the build
      # target to wasm32-wasip1.
      harpoonWasm = rustWasmPlatform.buildRustPackage {
        pname = "harpoon-zellij-plugin";
        version = "unstable";
        src = harpoon;
        cargoLock.lockFile = "${harpoon}/Cargo.lock";
        doCheck = false;

        # A transitive dependency's build.rs (openssl-sys) always compiles
        # for the host, even though the crate itself targets wasm — needs
        # pkg-config + real OpenSSL headers to find it, neither of which
        # are in the sandbox by default.
        nativeBuildInputs = [ pkgs.pkg-config ];
        buildInputs = [ pkgs.openssl ];

        # buildRustPackage's default buildPhase derives its own --target
        # from stdenv.hostPlatform (native x86_64-linux) regardless of
        # env.CARGO_BUILD_TARGET, so that env var alone silently built a
        # native binary — which can never link (zellij-tile's host-import
        # symbols, e.g. host_run_plugin_command, only resolve under the
        # real wasm32-wasip1 target). Call cargo directly instead, same as
        # zj-agent-harpoon's own wasmPlugins derivation.
        buildPhase = ''
          runHook preBuild
          cargo build --release --offline --target wasm32-wasip1
          runHook postBuild
        '';

        installPhase = ''
          runHook preInstall
          mkdir -p $out/lib/zellij
          install -Dm644 target/wasm32-wasip1/release/harpoon.wasm \
            $out/lib/zellij/harpoon.wasm
          runHook postInstall
        '';
      };

      # zjstatus ships its own flake (crane-built); just take its package
      # directly rather than re-deriving the build. NOT verified against a
      # real build from here (this Mac has no `nix` binary) — if the
      # artifact isn't at bin/zjstatus.wasm, the rebuild will say so and the
      # path below is the one place to fix.
      zjstatusWasm = "${zjstatus.packages.${system}.default}/bin/zjstatus.wasm";
    in
    {
      nixosConfigurations.herdr = nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [
          ./configuration.nix
          zj-agent-harpoon.nixosModules.default
        ];
        specialArgs = {
          inherit herdr zj-agent-harpoon;
          harpoonWasm = "${harpoonWasm}/lib/zellij/harpoon.wasm";
          inherit zjstatusWasm;
        };
      };
    };
}
