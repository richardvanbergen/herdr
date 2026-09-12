{ config, pkgs, herdr, zj-agent-sidebar, ... }:

let
  agentShell = pkgs.writeShellScriptBin "agent-shell" ''
    export SHELL=${pkgs.bash}/bin/bash
    ${pkgs.zellij}/bin/zellij attach -c main
    # detach/exit lands back in a real shell instead of killing SSH
    exec ${pkgs.bash}/bin/bash
  '';

  # Agent hook wiring for zj-agent-sidebar — deployed declaratively here
  # instead of hand-pasted (overrides that repo's "manual on purpose" rule;
  # L+ symlinks reset on every rebuild, so manual edits don't survive).
  # Paths go through /home/agent/Code/zj-agent-state (tmpfiles symlink to
  # the pinned repo source), matching what the hooks expect.
  claudeHook = status: {
    type = "command";
    command = "sh /home/agent/Code/zj-agent-state/hooks/claude-status.sh ${status}";
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
    command = "ZJ_AGENT_STATE_CODEX_HOOK=v1 sh /home/agent/Code/zj-agent-state/hooks/codex-status.sh";
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
    pkgs.jq
    pkgs.python3
    herdr.packages.x86_64-linux.default
  ];

  environment.shells = [ "${agentShell}/bin/agent-shell" ];

  environment.loginShellInit = ''
    if [ "$USER" = agent ]; then
      cd /home/agent/Code
    fi
  '';

  # /etc/nixos maintained by richard + agent via git. Ownership Z rule +
  # recursive access ACL (A+) give the users group write on everything —
  # both users edit through the group, regardless of which owns a file.
  # Default ACL on the root dir self-heals newly git-written files (git's
  # core.sharedRepository=group also requests group-write, the two agree).
  # Avoid "Z ... 2775": its mode recurses onto plain files (setgid/exec
  # churn in git).
  systemd.tmpfiles.rules = [
    "Z /etc/nixos - agent users - -"
    "A+ /etc/nixos - - - - group:users:rwX"
    "a+ /etc/nixos - - - - default:group:users:rwx"
    "d /home/agent/Code 0755 agent users - -"
    "L+ /home/agent/.config/zellij/plugins/zj-agent-state-watcher.wasm - - - - ${config.programs.zj-agent-sidebar.package}/lib/zellij/zj-agent-state-watcher.wasm"
    "L+ /home/agent/.config/zellij/plugins/zj-agent-state-sidebar.wasm - - - - ${config.programs.zj-agent-sidebar.package}/lib/zellij/zj-agent-state-sidebar.wasm"
    "L+ /home/agent/Code/zj-agent-state - - - - ${zj-agent-sidebar.packages.x86_64-linux.wasmPlugins.src}"
    "L+ /home/agent/.claude/settings.json - - - - ${claudeSettings}"
    "L+ /home/agent/.codex/hooks.json - - - - ${codexHooks}"
    "L+ /home/agent/.config/opencode/plugins/zj-agent-state.js - - - - ${zj-agent-sidebar.packages.x86_64-linux.wasmPlugins.src}/hooks/opencode-bridge.js"
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
