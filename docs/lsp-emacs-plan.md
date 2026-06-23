# LSP and GNU Emacs Plan

## Goal

Build an editor-neutral MOOS-IvP language server and a small GNU Emacs integration that reuses the validated VS Code 1.0.0 language behavior.

## Scope

In scope for this repo:

- Shared language core.
- LSP server.
- GNU Emacs integration.
- Tests that prove extracted behavior matches the VS Code 1.0.0 baseline.

Out of scope for this first phase:

- Vim, Neovim, Nano, or other editor integrations.
- Reworking the existing VS Code extension to consume this server.
- New MOOS-IvP language behavior beyond what is already validated in the VS Code 1.0.0 branch.

## Step-by-Step Plan

1. Capture the VS Code 1.0.0 behavior baseline.
   - Preserve fixture coverage for diagnostics, geometry checks, formatting, hover metadata, and feature toggles.
   - Keep current behavior stable during extraction.

2. Move editor-neutral logic into `packages/core`.
   - Scanner and block-state helpers.
   - Formatter.
   - Validators and geometry diagnostics.
   - Registry and metadata lookup.
   - Hover text generation.
   - Plain diagnostic, hover, formatting, folding, and semantic-token records.

3. Keep core independent from editor APIs.
   - No `vscode` imports.
   - No Emacs-specific code.
   - Inputs are plain text, language ids, positions, and options.
   - Outputs are plain JavaScript records.

4. Build the LSP wrapper in `packages/server`.
   - Document open/change synchronization.
   - Diagnostics publishing.
   - Hover responses.
   - Document formatting.
   - Later: folding ranges, completion, document symbols, and semantic tokens if useful.

5. Build the GNU Emacs integration in `editors/emacs`.
   - Major mode for `.moos`, `.bhv`, `.xmoos`, and `.xbhv`.
   - Basic syntax highlighting.
   - `eglot` server registration.
   - Format-buffer command that delegates to LSP formatting.

6. Validate end to end.
   - Core fixture tests.
   - Server smoke tests.
   - Manual Emacs test with `eglot`, Flymake diagnostics, hover/help, and formatting.

## First Milestone

A GNU Emacs user can open a `.moos` or `.bhv` file, start `eglot`, see diagnostics, request hover/help, and format the buffer using the shared language server.

