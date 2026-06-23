# GNU Emacs Integration

This folder contains the initial GNU Emacs integration for the MOOS-IvP language server.

## Install for Local Development

From the repository root:

```bash
npm install
npm link --workspace @moos-ivp/language-server
```

Then add this folder to your Emacs load path:

```elisp
(add-to-list 'load-path "/path/to/moos-ivp-language-server/editors/emacs")
(require 'moos-ivp-mode)
```

Open a `.moos`, `.xmoos`, `.bhv`, or `.xbhv` file and run:

```elisp
M-x moos-ivp-eglot-ensure
```

## Current Features

- File association for MOOS-IvP mission files.
- Basic syntax highlighting.
- `eglot` registration for `moos-ivp-language-server`.
- LSP-backed diagnostics, hover, and formatting hooks.

The shared core now contains the validated VS Code 1.0.0 language modules and metadata. The next milestone is interactive Emacs testing and packaging polish.
