{
  description = "Development environment for RhizObsidian Obsidian plugin with Python support";

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

        claudette =  final.python3.pkgs.buildPythonPackage rec {
            pname = "claudette";
            version = "0.0.9";
            src = final.python3.pkgs.fetchPypi {
                inherit pname version;
                sha256 = "e8a848a10d491b93ba8a03ffd033a86e4ad4982a8df058053d06bcd5dc50f70f";
            };
            doCheck = false;
            propagatedBuildInputs = with final.python3.pkgs; [
                anthropic
            ];
        };
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

            # Python environment
            (python3.withPackages (ps: with ps; [
              flask
              claudette
              flask-cors
            ]))
          ];

          shellHook = ''
            echo "RhizObsidian development environment"
            echo "Node.js version: $(node --version)"
            echo "Yarn version: $(yarn --version)"
            echo "TypeScript version: $(tsc --version)"
            echo "Python version: $(python --version)"
            echo "Flask version: $(python -c 'import flask; print(flask.__version__)')"

            npm install
          '';
        };
      });
    };
}
