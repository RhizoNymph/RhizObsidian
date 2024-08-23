{
  description = "Development environment for RhizObsidian Obsidian plugin";

  inputs.nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0.1.*.tar.gz";

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forEachSupportedSystem = f: nixpkgs.lib.genAttrs supportedSystems (system: f {
        pkgs = import nixpkgs { inherit system; overlays = [ self.overlays.default ]; };
      });
    in
    {
      overlays.default = final: prev: {
        nodejs = prev.nodejs;
        yarn = (prev.yarn.override { inherit (final) nodejs; });
      };

      devShells = forEachSupportedSystem ({ pkgs }: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs
            yarn
            nodePackages.typescript
            nodePackages.typescript-language-server
            nodePackages.eslint
            nodePackages.prettier
          ];

          shellHook = ''
            echo "RhizObsidian development environment"
            echo "Node.js version: $(node --version)"
            echo "Yarn version: $(yarn --version)"
            echo "TypeScript version: $(tsc --version)"

            npm install
          '';
        };
      });
    };
}