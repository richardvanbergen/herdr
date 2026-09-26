{ lib, buildNpmPackage, nodejs_24, makeWrapper, python3, pkg-config, vips }:

buildNpmPackage {
  pname = "paperclip";
  version = "2026.916.1";
  src = ./.;
  nodejs = nodejs_24;
  npmDepsHash = "sha256-CYKHf8qKOUsCDVwU2npYlYHh/dtWX5JT+dWYa7jh500=";
  dontNpmBuild = true;
  # Published packages contain the built server, UI and adapters. Do not run
  # upstream lifecycle installers (embedded Postgres / agent binary downloads).
  npmFlags = [ "--ignore-scripts" ];
  nativeBuildInputs = [ makeWrapper python3 pkg-config ];
  buildInputs = [ vips ];
  installPhase = ''
    runHook preInstall
    mkdir -p $out/lib/paperclip $out/bin
    cp -R node_modules $out/lib/paperclip/
    ui="$out/lib/paperclip/node_modules/@paperclipai/server/ui-dist"
    cp ${./http-crypto.js} "$ui/assets/herdr-http-crypto.js"
    # Load before the upstream module bundle, including on insecure HTTP.
    substituteInPlace "$ui/index.html" \
      --replace-fail '<head>' '<head><script src="/assets/herdr-http-crypto.js"></script>'
    makeWrapper ${nodejs_24}/bin/node $out/bin/paperclip-server \
      --add-flags "$out/lib/paperclip/node_modules/@paperclipai/server/dist/index.js"
    makeWrapper ${nodejs_24}/bin/node $out/bin/paperclipai \
      --add-flags "$out/lib/paperclip/node_modules/paperclipai/dist/index.js"
    runHook postInstall
  '';
  meta = {
    description = "Paperclip agent orchestration server and CLI";
    homepage = "https://github.com/paperclipai/paperclip";
    license = lib.licenses.mit;
    platforms = [ "x86_64-linux" ];
  };
}
