# MOOS-IvP Language Server

Editor-neutral language tooling for MOOS-IvP mission files.

This repository is the starting point for sharing MOOS-IvP language intelligence outside the VS Code extension. The first supported editor target is GNU Emacs through LSP.

## Layout

```text
packages/core/      Editor-neutral parser, formatter, diagnostics, and hover helpers.
packages/server/    Language Server Protocol wrapper around the core.
editors/emacs/      GNU Emacs major mode and eglot integration.
docs/               Planning notes and migration roadmap.
```

## Current Status

This is an initial scaffold. It has a runnable LSP server with basic MOOS-IvP file detection, starter diagnostics, starter hover text, and formatting plumbing. The next milestone is to port the validated VS Code 1.0.0 core behavior into `packages/core` without changing behavior.

## Development

```bash
npm install
npm run check
```

Run the server manually:

```bash
npm run start --workspace @moos-ivp/language-server -- --stdio
```

Check files without an editor:

```bash
npx moos-ivp-language-server --check examples/all_apps.moos examples/all_behaviors.bhv
```

## Emacs

The Emacs package lives in `editors/emacs/moos-ivp-mode.el`. It registers MOOS-IvP file extensions and configures `eglot` to start `moos-ivp-language-server`.

See [docs/lsp-emacs-plan.md](docs/lsp-emacs-plan.md) for the implementation plan.
