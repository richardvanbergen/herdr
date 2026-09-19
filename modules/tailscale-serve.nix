# Declarative tailscale serve: proxy HTTPS to Charon on localhost:80.
# Tailscale auto-provisions a Let's Encrypt cert for this node's
# MagicDNS name (herdr.<tailnet>.ts.net). Only reachable from the tailnet.
{
  systemd.services.tailscale-serve = {
    description = "Configure tailscale serve for Charon (HTTPS -> localhost:80)";
    after = [ "tailscaled.service" ];
    wants = [ "tailscaled.service" ];
    wantedBy = [ "multi-user.target" ];
    path = [ "/run/current-system/sw" ];
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
      ExecStart = "/run/current-system/sw/bin/tailscale serve --bg http://localhost:80";
      ExecStop = "/run/current-system/sw/bin/tailscale serve reset";
    };
  };
}
