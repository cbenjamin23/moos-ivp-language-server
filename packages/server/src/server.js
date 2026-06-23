#!/usr/bin/env node
"use strict";

const {
  createConnection,
  DiagnosticSeverity,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments
} = require("vscode-languageserver/node");
const { TextDocument } = require("vscode-languageserver-textdocument");
const {
  collectDiagnostics,
  formatText,
  hoverAtPosition,
  languageIdForUri
} = require("@moos-ivp/language-core");

if (process.argv.includes("--version")) {
  process.stdout.write("moos-ivp-language-server 0.1.0\n");
  process.exit(0);
}

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

function documentLanguage(document) {
  return languageIdForUri(document.uri) || document.languageId;
}

function toLspDiagnostic(record) {
  return {
    severity: DiagnosticSeverity.Warning,
    range: record.range,
    message: record.message,
    source: "moos-ivp",
    code: record.code
  };
}

function validateDocument(document) {
  const language = documentLanguage(document);
  const diagnostics = collectDiagnostics(document.getText(), language).map(toLspDiagnostic);

  connection.sendDiagnostics({
    uri: document.uri,
    diagnostics
  });
}

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    hoverProvider: true,
    documentFormattingProvider: true
  }
}));

documents.onDidOpen((event) => {
  validateDocument(event.document);
});

documents.onDidChangeContent((event) => {
  validateDocument(event.document);
});

documents.onDidClose((event) => {
  connection.sendDiagnostics({
    uri: event.document.uri,
    diagnostics: []
  });
});

connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);

  if (!document) {
    return null;
  }

  const hover = hoverAtPosition(document.getText(), documentLanguage(document), params.position);

  if (!hover) {
    return null;
  }

  return {
    contents: {
      kind: "markdown",
      value: hover.contents
    },
    range: hover.range
  };
});

connection.onDocumentFormatting((params) => {
  const document = documents.get(params.textDocument.uri);

  if (!document) {
    return [];
  }

  const text = document.getText();
  const formatted = formatText(text, documentLanguage(document));

  if (formatted === text) {
    return [];
  }

  return [{
    range: {
      start: { line: 0, character: 0 },
      end: document.positionAt(text.length)
    },
    newText: formatted
  }];
});

documents.listen(connection);
connection.listen();

