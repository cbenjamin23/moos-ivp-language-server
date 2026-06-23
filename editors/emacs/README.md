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
M-x eglot
```

## Current Features

- File association for MOOS-IvP mission files.
- Basic syntax highlighting.
- `eglot` registration for `moos-ivp-language-server`.
- LSP-backed diagnostics, hover, and formatting hooks.

The current language behavior is intentionally minimal. The next milestone is porting the validated VS Code 1.0.0 language behavior into the shared core.

