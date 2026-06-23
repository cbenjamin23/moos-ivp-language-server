"use strict";

const MOOS_EXTENSIONS = new Set([".moos", ".xmoos"]);
const BEHAVIOR_EXTENSIONS = new Set([".bhv", ".xbhv"]);

function uriPath(uriOrPath) {
  if (!uriOrPath) {
    return "";
  }

  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uriOrPath)) {
      return decodeURIComponent(new URL(uriOrPath).pathname);
    }
  } catch (_error) {
    return uriOrPath;
  }

  return uriOrPath;
}

function extensionName(path) {
  const match = uriPath(path).toLowerCase().match(/(\.[^.\/\\]+)$/);
  return match ? match[1] : "";
}

function languageIdForUri(uriOrPath) {
  const extension = extensionName(uriOrPath);

  if (MOOS_EXTENSIONS.has(extension)) {
    return "moos";
  }

  if (BEHAVIOR_EXTENSIONS.has(extension)) {
    return "ivp-behavior";
  }

  return null;
}

function lineOffsets(text) {
  const offsets = [0];

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      offsets.push(index + 1);
    }
  }

  return offsets;
}

function wordAtPosition(text, position) {
  const offsets = lineOffsets(text);
  const lineOffset = offsets[position.line] ?? 0;
  const nextOffset = offsets[position.line + 1] ?? text.length;
  const lineText = text.slice(lineOffset, nextOffset).replace(/\r?\n$/, "");
  const character = Math.min(position.character, lineText.length);

  let start = character;
  while (start > 0 && /[A-Za-z0-9_:-]/.test(lineText[start - 1])) {
    start -= 1;
  }

  let end = character;
  while (end < lineText.length && /[A-Za-z0-9_:-]/.test(lineText[end])) {
    end += 1;
  }

  if (start === end) {
    return null;
  }

  return {
    text: lineText.slice(start, end),
    range: {
      start: { line: position.line, character: start },
      end: { line: position.line, character: end }
    }
  };
}

function diagnostic(line, character, message, code) {
  return {
    severity: "warning",
    code,
    message,
    range: {
      start: { line, character },
      end: { line, character: Math.max(character + 1, character) }
    }
  };
}

function collectDiagnostics(text, language) {
  const diagnostics = [];
  const lines = text.split(/\r?\n/);
  let balance = 0;

  lines.forEach((line, lineNumber) => {
    const commentIndex = line.indexOf("//");
    const code = commentIndex >= 0 ? line.slice(0, commentIndex) : line;

    for (const char of code) {
      if (char === "{") {
        balance += 1;
      } else if (char === "}") {
        balance -= 1;
        if (balance < 0) {
          diagnostics.push(diagnostic(lineNumber, line.indexOf("}"), "Closing brace has no matching opening brace.", "moos-ivp.unmatched-closing-brace"));
          balance = 0;
        }
      }
    }

    if (language === "moos" && /^\s*ProcessConfig\s*=/.test(code) && !code.includes("{")) {
      const nextLine = lines[lineNumber + 1] || "";
      if (!/^\s*\{/.test(nextLine)) {
        diagnostics.push(diagnostic(lineNumber, line.search(/\S/), "ProcessConfig blocks should be followed by an opening brace.", "moos-ivp.process-config-brace"));
      }
    }
  });

  if (balance > 0) {
    const lastLine = Math.max(0, lines.length - 1);
    diagnostics.push(diagnostic(lastLine, 0, "Opening brace has no matching closing brace.", "moos-ivp.unmatched-opening-brace"));
  }

  return diagnostics;
}

function hoverAtPosition(text, language, position) {
  const word = wordAtPosition(text, position);

  if (!word) {
    return null;
  }

  const normalized = word.text.toLowerCase();
  const entries = {
    processconfig: "Defines configuration for a MOOS app process in a `.moos` mission file.",
    behavior: "Defines an IvP Helm behavior block in a `.bhv` file.",
    apptick: "MOOS app iterate frequency, in hertz.",
    commstick: "MOOS app communications frequency, in hertz.",
    condition: "Behavior condition that must be true for the behavior to run.",
    updates: "MOOS variable used to receive behavior update messages."
  };

  const value = entries[normalized];
  if (!value) {
    return null;
  }

  return {
    contents: value,
    range: word.range
  };
}

function formatText(text) {
  const withoutTrailingWhitespace = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n");

  return withoutTrailingWhitespace.endsWith("\n")
    ? withoutTrailingWhitespace
    : `${withoutTrailingWhitespace}\n`;
}

module.exports = {
  collectDiagnostics,
  formatText,
  hoverAtPosition,
  languageIdForUri,
  wordAtPosition
};

