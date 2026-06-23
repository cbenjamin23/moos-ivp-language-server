"use strict";

const path = require("path");
const { createTextDocument, fullDocumentRange } = require("./document");
const { collectConfigDiagnosticRecords } = require("./diagnostics");
const { formatMoosIvpText, formatDocument, defaultFormattingOptions } = require("./formatter");
const { validateGeometryValue } = require("./geometry");
const { createHoverProvider } = require("./hover");
const { loadLanguageRegistry } = require("./registry");

const MOOS_EXTENSIONS = new Set([".moos", ".xmoos"]);
const BEHAVIOR_EXTENSIONS = new Set([".bhv", ".xbhv"]);

let registry;

function coreContext() {
  return {
    extensionPath: path.join(__dirname, "..")
  };
}

function languageRegistry() {
  if (!registry) {
    registry = loadLanguageRegistry(coreContext());
  }
  return registry;
}

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

function extensionName(pathOrUri) {
  const match = uriPath(pathOrUri).toLowerCase().match(/(\.[^.\/\\]+)$/);
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

function createValueDiagnostic(record) {
  const end = Math.max(record.valueStart + record.valueText.length, record.valueStart + 1);
  return {
    severity: "warning",
    source: "MOOS-IvP",
    code: "schema-value",
    message: record.message,
    range: {
      start: { line: record.lineNumber, character: record.valueStart },
      end: { line: record.lineNumber, character: end }
    }
  };
}

function createFormattingDiagnostic(document, issue) {
  const line = Math.min(issue.lineNumber, Math.max(0, document.lineCount - 1));
  const lineText = document.lineAt(line).text || "";
  return {
    severity: "warning",
    source: "MOOS-IvP Format",
    code: issue.code,
    message: issue.message,
    range: {
      start: { line, character: 0 },
      end: { line, character: Math.max(1, lineText.length) }
    }
  };
}

function normalizeDiagnosticOptions(options = {}) {
  return {
    schemaEnabled: options.schemaEnabled !== false,
    geometryEnabled: options.geometryEnabled !== false,
    formattingEnabled: options.formattingEnabled !== false,
    formattingOptions: defaultFormattingOptions(options.formattingOptions || options)
  };
}

function collectDiagnostics(text, language, options = {}) {
  const diagnostics = [];
  const diagnosticOptions = normalizeDiagnosticOptions(options);
  const document = createTextDocument(text, language);

  if (diagnosticOptions.schemaEnabled) {
    diagnostics.push(...collectConfigDiagnosticRecords(
      document,
      languageRegistry().diagnosticSchema,
      language,
      { geometryEnabled: diagnosticOptions.geometryEnabled }
    ).map(createValueDiagnostic));
  }

  if (diagnosticOptions.formattingEnabled) {
    diagnostics.push(...formatDocument(
      document,
      language,
      diagnosticOptions.formattingOptions
    ).issues.map((issue) => createFormattingDiagnostic(document, issue)));
  }

  return diagnostics;
}

class PlainMarkdownString {
  constructor() {
    this.value = "";
  }

  appendMarkdown(value) {
    this.value += value;
  }

  toString() {
    return this.value;
  }
}

class PlainHover {
  constructor(contents, range) {
    this.contents = contents;
    this.range = range;
  }
}

function fakeVscode() {
  return {
    MarkdownString: PlainMarkdownString,
    Hover: PlainHover
  };
}

function hoverProviderFor(language) {
  const loaded = languageRegistry();
  if (language === "ivp-behavior") {
    return createHoverProvider(
      fakeVscode(),
      language,
      loaded.bhvLookup,
      loaded.bhvDocLookup,
      loaded.bhvSourceLookup,
      loaded.diagnosticSchema
    );
  }

  return createHoverProvider(
    fakeVscode(),
    language,
    loaded.moosLookup,
    loaded.moosDocLookup,
    loaded.moosSourceLookup,
    loaded.diagnosticSchema
  );
}

function hoverAtPosition(text, language, position) {
  const document = createTextDocument(text, language);
  const hover = hoverProviderFor(language).provideHover(document, position);

  if (!hover) {
    return null;
  }

  return {
    contents: String(hover.contents.value || hover.contents),
    range: hover.range
  };
}

function formatText(text, language, options = {}) {
  return formatMoosIvpText(text, language, options).text;
}

function formatTextWithIssues(text, language, options = {}) {
  return formatMoosIvpText(text, language, options);
}

module.exports = {
  collectDiagnostics,
  createTextDocument,
  formatText,
  formatTextWithIssues,
  fullDocumentRange,
  hoverAtPosition,
  languageIdForUri,
  languageRegistry,
  validateGeometryValue
};
