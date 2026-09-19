{ config, pkgs, zj-agent-harpoon, ... }:

let
  loginShell = pkgs.writeShellScriptBin "richard-shell" ''
    export SHELL=${pkgs.bash}/bin/bash
    # Preserve SSH commands, rebuilds and SCP instead of starting Zellij.
    if [ "$#" -gt 0 ]; then
      exec ${pkgs.bash}/bin/bash "$@"
    fi
    if [ -t 0 ] && [ -t 1 ] && [ -z "''${ZELLIJ:-}" ]; then
      cd /code
      ${pkgs.zellij}/bin/zellij attach -c main
    fi
    # Detaching leaves a usable shell without recursively starting Zellij.
    exec ${pkgs.bash}/bin/bash -l
  '';

  # Agent hook wiring for zj-agent-harpoon — deployed declaratively here
  # instead of hand-pasted (overrides that repo's "manual on purpose" rule;
  # L+ symlinks reset on every rebuild, so manual edits don't survive).
  # Paths go through /home/richard/Code/zj-agent-harpoon (tmpfiles symlink to
  # the pinned repo source), matching what the hooks expect.
  claudeHook = status: {
    type = "command";
    command = "sh /home/richard/Code/zj-agent-harpoon/hooks/claude-status.sh ${status}";
    timeout = 10;
  };
  claudeSettings = pkgs.writeText "claude-settings.json" (builtins.toJSON {
    theme = "dark";
    hooks = {
      UserPromptSubmit = [ { hooks = [ (claudeHook "working") ]; } ];
      Notification = [ { hooks = [ (claudeHook "blocked") ]; } ];
      Stop = [ { hooks = [ (claudeHook "done") ]; } ];
    };
  });
  codexHook = {
    type = "command";
    command = "ZJ_AGENT_STATE_CODEX_HOOK=v1 sh /home/richard/Code/zj-agent-harpoon/hooks/codex-status.sh";
    timeout = 10;
  };
  codexHooks = pkgs.writeText "codex-hooks.json" (builtins.toJSON {
    hooks = builtins.listToAttrs (map
      (event: {
        name = event;
        value = [ { hooks = [ codexHook ]; } ];
      })
      [
        "UserPromptSubmit"
        "PreToolUse"
        "PermissionRequest"
        "PostToolUse"
        "SubagentStart"
        "SubagentStop"
        "Stop"
      ]);
  });
in
{
  programs.zj-agent-harpoon = {
    enable = true;
    agents.enable = true;
  };

  environment.shells = [ "${loginShell}/bin/richard-shell" ];

  environment.loginShellInit = ''
    if [ "$USER" = richard ]; then
      cd /code
    fi
  '';

  # Richard owns the development workspace and agent-tool integration.
  systemd.tmpfiles.rules = [
    "d /code 0755 richard users - -"
    "d /home/richard/Code 0755 richard users - -"
    # Symlinks/dirs under Richard's home must be owned by Richard:
    # root-owned entries under a user-owned home make systemd-tmpfiles
    # skip them with "unsafe path transition" — which silently left the
    # old plugin wasm deployed after input updates.
    "d /home/richard/.config 0755 richard users - -"
    "d /home/richard/.config/zellij/plugins 0755 richard users - -"
    "d /home/richard/.config/opencode/plugins 0755 richard users - -"
    "d /home/richard/.codex 0755 richard users - -"
    "d /home/richard/.claude 0755 richard users - -"
    "L+ /home/richard/Code/zj-agent-harpoon - richard users - ${zj-agent-harpoon.packages.x86_64-linux.wasmPlugins.src}"
    "L+ /home/richard/.claude/settings.json - richard users - ${claudeSettings}"
    "L+ /home/richard/.codex/hooks.json - richard users - ${codexHooks}"
    "L+ /home/richard/.config/opencode/plugins/zj-agent-harpoon.js - richard users - ${zj-agent-harpoon.packages.x86_64-linux.wasmPlugins.src}/hooks/opencode-bridge.js"
  ];

  users.users.richard.shell = "${loginShell}/bin/richard-shell";
}
