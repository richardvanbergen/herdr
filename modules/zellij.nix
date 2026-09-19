{ config, pkgs, harpoonWasm, zjstatusWasm, ... }:

let
  # richard's config mirrors his local Mac setup verbatim (same file,
  # copied byte-for-byte) — its plugin paths use `~`, which resolves fine
  # per-user, so no per-machine path rewriting needed.
  richardZellijConfig = builtins.path {
    path = ../zellij/richard-config.kdl;
    name = "richard-zellij-config";
  };
  richardZellijLayout = builtins.path {
    path = ../zellij/richard-layout-default.kdl;
    name = "richard-zellij-layout";
  };
in
{
  systemd.tmpfiles.rules = [
    # Explicit owned parent dirs, not left to L+'s auto-mkdir: a root-owned
    # intermediate dir under a user's home makes systemd-tmpfiles skip
    # later entries with "unsafe path transition" (agent-env.nix hit this
    # already for the plugins dir).

    "d /home/richard/.config 0755 richard users - -"
    "d /home/richard/.config/zellij 0755 richard users - -"
    "d /home/richard/.config/zellij/plugins 0755 richard users - -"
    "d /home/richard/.config/zellij/layouts 0755 richard users - -"
    "L+ /home/richard/.config/zellij/config.kdl - richard users - ${richardZellijConfig}"
    "L+ /home/richard/.config/zellij/layouts/default.kdl - richard users - ${richardZellijLayout}"
    "L+ /home/richard/.config/zellij/plugins/harpoon.wasm - richard users - ${harpoonWasm}"
    "L+ /home/richard/.config/zellij/plugins/zjstatus.wasm - richard users - ${zjstatusWasm}"
    # Alt+a uses the pinned agent-harpoon plugins.
    "L+ /home/richard/.config/zellij/plugins/zj-agent-state-watcher.wasm - richard users - ${config.programs.zj-agent-harpoon.package}/lib/zellij/zj-agent-state-watcher.wasm"
    "L+ /home/richard/.config/zellij/plugins/zj-agent-state-harpoon.wasm - richard users - ${config.programs.zj-agent-harpoon.package}/lib/zellij/zj-agent-state-harpoon.wasm"
  ];
}
