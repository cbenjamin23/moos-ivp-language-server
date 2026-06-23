"use strict";

const path = require("path");
const { createTextDocument, fullDocumentRange } = require("./document");
const { collectConfigDiagnosticRecords } = require("./diagnostics");
const { formatMoosIvpText, formatDocument, defaultFormattingOptions } = require("./formatter");
const { validateGeometryValue } = require("./geometry");
const { createHoverProvider } = require("./hover");
const { loadLanguageRegistry } = require("./registry");
const { findCurrentOwner, parameterLookupName } = require("./scanner");

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

function ownerVariants(owner, language) {
  if (!owner || language !== "ivp-behavior") {
    return [owner];
  }

  const variants = [owner];
  if (owner.startsWith("BHV_")) {
    variants.push(owner.slice(4));
  } else {
    variants.push(`BHV_${owner}`);
  }
  return [...new Set(variants)];
}

function completionFromItem(item) {
  return {
    label: item.name,
    detail: item.kind,
    documentation: item.description
  };
}

function ownerCompletionItems(language) {
  const loaded = languageRegistry();
  const lookup = language === "ivp-behavior" ? loaded.bhvLookup : loaded.moosLookup;
  const docLookup = language === "ivp-behavior" ? loaded.bhvDocLookup : loaded.moosDocLookup;
  const sourceLookup = language === "ivp-behavior" ? loaded.bhvSourceLookup : loaded.moosSourceLookup;
  const ownerKind = language === "ivp-behavior" ? "IvP behavior" : "MOOS app";
  const items = new Map();

  [lookup, docLookup.ownerLookup, sourceLookup.ownerLookup].forEach((source) => {
    source.forEach((item) => {
      if (!item.owner && item.kind === ownerKind) {
        items.set(item.name.toLowerCase(), completionFromItem(item));
      }
    });
  });

  return [...items.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function schemaParametersForOwner(schema, language, owner) {
  const parameters = new Map();

  function addParameters(container, detail) {
    Object.keys((container && container.parameters) || {}).forEach((name) => {
      const entry = container.parameters[name];
      parameters.set(parameterLookupName(name).toLowerCase(), {
        label: name,
        detail,
        documentation: entry.notes || entry.valueType || ""
      });
    });
  }

  if (language === "moos") {
    ownerVariants(owner, language).forEach((variant) => {
      addParameters(schema.apps && schema.apps[variant], `${variant} parameter`);
    });
    return parameters;
  }

  let ownerItem;
  ownerVariants(owner, language).forEach((variant) => {
    const item = schema.behaviors && schema.behaviors[variant];
    if (item && !ownerItem) {
      ownerItem = item;
    }
    addParameters(item, `${variant} parameter`);
  });

  addParameters(schema.shared && schema.shared.ivpBehavior, "inherited behavior parameter");
  if ((ownerItem && ownerItem.inherits || []).includes("ivpContactBehavior")) {
    addParameters(schema.shared && schema.shared.ivpContactBehavior, "inherited contact behavior parameter");
  }

  return parameters;
}

function completionItemsAtPosition(text, language, position) {
  const document = createTextDocument(text, language);
  const line = document.lineAt(position.line).text;
  const prefix = line.slice(0, position.character);

  if (language === "moos" && /^\s*ProcessConfig\s*=\s*[A-Za-z0-9_]*$/i.test(prefix)) {
    return ownerCompletionItems(language);
  }

  if (language === "ivp-behavior" && /^\s*Behavior\s*=\s*[A-Za-z0-9_]*$/.test(prefix)) {
    return ownerCompletionItems(language);
  }

  if (!/^\s*[A-Za-z_][A-Za-z0-9_+:-]*$/.test(prefix)) {
    return [];
  }

  const owner = findCurrentOwner(document, position, language);
  if (!owner) {
    return [];
  }

  return [...schemaParametersForOwner(languageRegistry().diagnosticSchema, language, owner).values()]
    .sort((a, b) => a.label.localeCompare(b.label));
}

module.exports = {
  collectDiagnostics,
  completionItemsAtPosition,
  createTextDocument,
  formatText,
  formatTextWithIssues,
  fullDocumentRange,
  hoverAtPosition,
  languageIdForUri,
  languageRegistry,
  validateGeometryValue
};
