{ config, pkgs, ... }:

let
  # Neovim 0.13 does not exist yet — latest stable line is 0.12.x, which
  # nixos-26.05 ships. Matches the local Mac install (0.12.5).
  nvimConfig = builtins.path {
    path = ./nvim;
    name = "nvim-config";
  };
in
{
  environment.systemPackages = [ pkgs.neovim ];

  # Cargo-culted from the local machine's ~/.config/nvim. LazyVim bootstraps
  # lazy.nvim and plugin deps itself on first launch (self-contained against
  # $XDG_DATA_HOME), so only the config is pinned here. oil.nvim + zellij.vim
  # included; bufferline (tab bar) disabled via lua/plugins/disabled.lua.
  systemd.tmpfiles.rules = [
    "R /home/agent/.config/nvim - - - -"
    "L+ /home/agent/.config/nvim - - - - ${nvimConfig}"
  ];
}
