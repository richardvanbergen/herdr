{ config, pkgs, zj-agent-harpoon, ... }:

let
  agentShell = pkgs.writeShellScriptBin "agent-shell" ''
    export SHELL=${pkgs.bash}/bin/bash
    ${pkgs.zellij}/bin/zellij attach -c main
    # detach/exit lands back in a real shell instead of killing SSH
    exec ${pkgs.bash}/bin/bash
  '';

  # Agent hook wiring for zj-agent-harpoon — deployed declaratively here
  # instead of hand-pasted (overrides that repo's "manual on purpose" rule;
  # L+ symlinks reset on every rebuild, so manual edits don't survive).
  # Paths go through /home/agent/Code/zj-agent-harpoon (tmpfiles symlink to
  # the pinned repo source), matching what the hooks expect.
  claudeHook = status: {
    type = "command";
    command = "sh /home/agent/Code/zj-agent-harpoon/hooks/claude-status.sh ${status}";
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
    command = "ZJ_AGENT_STATE_CODEX_HOOK=v1 sh /home/agent/Code/zj-agent-harpoon/hooks/codex-status.sh";
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

  environment.shells = [ "${agentShell}/bin/agent-shell" ];

  environment.loginShellInit = ''
    if [ "$USER" = agent ] || [ "$USER" = richard ]; then
      cd /code
    fi
  '';

  # Shared workspace: every user (agent, richard, future hermes) lands in
  # /code on login and shares group-write access there, same ACL pattern
  # as /etc/nixos. Human SSH sessions and agent sessions work on the same
  # tree without mode churn.
  systemd.tmpfiles.rules = [
    "d /code 2775 root users - -"
    "d /home/agent/Code 0755 agent users - -"
    # Symlinks/dirs under agent's home must be owned by agent themselves:
    # root-owned entries under an agent-owned home make systemd-tmpfiles
    # skip them with "unsafe path transition" — which silently left the
    # old plugin wasm deployed after input updates.
    "d /home/agent/.config 0755 agent users - -"
    "d /home/agent/.config/zellij/plugins 0755 agent users - -"
    "d /home/agent/.config/opencode/plugins 0755 agent users - -"
    "d /home/agent/.codex 0755 agent users - -"
    "d /home/agent/.claude 0755 agent users - -"
    "L+ /home/agent/.config/zellij/plugins/zj-agent-state-watcher.wasm - agent users - ${config.programs.zj-agent-harpoon.package}/lib/zellij/zj-agent-state-watcher.wasm"
    "L+ /home/agent/.config/zellij/plugins/zj-agent-state-harpoon.wasm - agent users - ${config.programs.zj-agent-harpoon.package}/lib/zellij/zj-agent-state-harpoon.wasm"
    "L+ /home/agent/Code/zj-agent-harpoon - agent users - ${zj-agent-harpoon.packages.x86_64-linux.wasmPlugins.src}"
    "L+ /home/agent/.claude/settings.json - agent users - ${claudeSettings}"
    "L+ /home/agent/.codex/hooks.json - agent users - ${codexHooks}"
    "L+ /home/agent/.config/opencode/plugins/zj-agent-harpoon.js - agent users - ${zj-agent-harpoon.packages.x86_64-linux.wasmPlugins.src}/hooks/opencode-bridge.js"
    "A+ /code - - - - group:users:rwX"
    "a+ /code - - - - default:group:users:rwx"
  ];

  users.users.agent = {
    isNormalUser = true;
    shell = "${agentShell}/bin/agent-shell";
    openssh.authorizedKeys.keys = [ "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDcSmcw1Cbz1ynL/yO/OzjwpJUYAvKDtbaq9kWMXDfarcVjZoD4IaD9g4I7g1xzX1tXo11YyzYLxvCkHf6hdy9WZ2827NJWbp65MXQ0kgKedsmZ/7THCtAiQbGzAGsRDOpdRSl9gT/TKwmk3OotKfJSdWxQRoJBSLSDLOYjeuJjMUtWcOKn+HQOD9v9daJKiqegJmah1EvLjmsre5M3RTL4FFyeSbxTgPITcqDn3lFkVdFsTsBHDGZPCOJRwUJ3KYRHHrRBrXCleyW08hsMukU42MpMpuRRW7xVFzyQ1ciwg2RKC6m29JIpuhUtflKIpVuaBwXjpEricfX551bmlmDvUrcvVjD1GCnu+g5+JelBaOF1oIaLvNWEAVdM8Z912kuDVIyZGRU8Sf2RQgxCGU2ETJ07G3i51rfJrolByEayV9PA73RLyCswRp+hZ0+0oUCxsHu0y+Ujk3Itr+AtYJwiK1oSt7LLLYgd1zjjlON4D73dqmVdr7HRCwhJlc4l03E= richard.vanbergen@Richards-MacBook-Pro-2.local" ];
  };
}
