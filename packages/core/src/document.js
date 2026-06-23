"use strict";

function lineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
}

function offsetAt(starts, text, position) {
  const line = Math.max(0, Math.min(position.line, starts.length - 1));
  const lineStart = starts[line];
  const nextLineStart = starts[line + 1] ?? text.length;
  const lineEnd = text[nextLineStart - 1] === "\n"
    ? nextLineStart - 1 - (text[nextLineStart - 2] === "\r" ? 1 : 0)
    : nextLineStart;
  return Math.max(lineStart, Math.min(lineStart + position.character, lineEnd));
}

function positionAt(starts, text, offset) {
  const target = Math.max(0, Math.min(offset, text.length));
  let low = 0;
  let high = starts.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] > target) {
      high = middle - 1;
    } else if (middle + 1 < starts.length && starts[middle + 1] <= target) {
      low = middle + 1;
    } else {
      return {
        line: middle,
        character: target - starts[middle]
      };
    }
  }

  return { line: 0, character: 0 };
}

function createRange(startLine, startCharacter, endLine, endCharacter) {
  return {
    start: { line: startLine, character: startCharacter },
    end: { line: endLine, character: endCharacter }
  };
}

function createTextDocument(text, languageId = "moos", uri = "file:///document.moos") {
  const starts = lineStarts(text);
  const lines = text.split(/\r?\n/);
  if (/\r?\n$/.test(text)) {
    lines.pop();
  }

  const document = {
    uri,
    languageId,
    lineCount: Math.max(1, lines.length),
    getText(range) {
      if (!range) {
        return text;
      }
      return text.slice(
        offsetAt(starts, text, range.start),
        offsetAt(starts, text, range.end)
      );
    },
    lineAt(lineNumber) {
      const line = Math.max(0, Math.min(lineNumber, lines.length - 1));
      return {
        lineNumber: line,
        text: lines[line] ?? ""
      };
    },
    offsetAt(position) {
      return offsetAt(starts, text, position);
    },
    positionAt(offset) {
      return positionAt(starts, text, offset);
    },
    getWordRangeAtPosition(position, pattern) {
      const line = this.lineAt(position.line).text;
      const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
      let match;

      while ((match = regex.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
          return createRange(position.line, start, position.line, end);
        }
        if (match[0].length === 0) {
          regex.lastIndex += 1;
        }
      }

      return undefined;
    }
  };

  return document;
}

function fullDocumentRange(document) {
  const lastLine = Math.max(0, document.lineCount - 1);
  const lastText = document.lineAt(lastLine).text || "";
  return createRange(0, 0, lastLine, lastText.length);
}

module.exports = {
  createRange,
  createTextDocument,
  fullDocumentRange
};

