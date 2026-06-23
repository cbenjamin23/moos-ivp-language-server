;;; moos-ivp-mode.el --- MOOS-IvP editing support -*- lexical-binding: t; -*-

;; This file is an initial Emacs integration for the MOOS-IvP language server.

;;; Code:

(require 'eglot nil t)

(defgroup moos-ivp nil
  "MOOS-IvP mission file editing support."
  :group 'languages)

(defcustom moos-ivp-language-server-command
  '("moos-ivp-language-server" "--stdio")
  "Command used by eglot to start the MOOS-IvP language server."
  :type '(repeat string)
  :group 'moos-ivp)

(defvar moos-ivp-font-lock-keywords
  '(("\\<\\(ProcessConfig\\|Behavior\\)\\>" . font-lock-keyword-face)
    ("^[[:space:]]*\\([A-Za-z_][A-Za-z0-9_]*\\)[[:space:]]*=" 1 font-lock-variable-name-face)
    ("//.*$" . font-lock-comment-face)))

;;;###autoload
(define-derived-mode moos-ivp-mode prog-mode "MOOS-IvP"
  "Major mode for MOOS-IvP `.moos` and `.bhv` files."
  (setq-local comment-start "// ")
  (setq-local comment-end "")
  (setq-local font-lock-defaults '(moos-ivp-font-lock-keywords)))

;;;###autoload
(defun moos-ivp-format-buffer ()
  "Format the current buffer using the active LSP server."
  (interactive)
  (if (fboundp 'eglot-format-buffer)
      (eglot-format-buffer)
    (user-error "eglot is not available")))

;;;###autoload
(add-to-list 'auto-mode-alist '("\\.x?moos\\'" . moos-ivp-mode))

;;;###autoload
(add-to-list 'auto-mode-alist '("\\.x?bhv\\'" . moos-ivp-mode))

(with-eval-after-load 'eglot
  (add-to-list 'eglot-server-programs
               `(moos-ivp-mode . ,moos-ivp-language-server-command)))

(provide 'moos-ivp-mode)

;;; moos-ivp-mode.el ends here

