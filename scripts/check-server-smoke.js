#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const SERVER_PATH = path.join(REPO_ROOT, "packages/server/src/server.js");

function encode(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function createParser(onMessage) {
  let buffer = Buffer.alloc(0);

  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }

      const header = buffer.slice(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length: (\d+)/i);
      if (!match) {
        throw new Error(`Missing Content-Length header: ${header}`);
      }

      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + length;
      if (buffer.length < bodyEnd) {
        return;
      }

      const message = JSON.parse(buffer.slice(bodyStart, bodyEnd).toString("utf8"));
      buffer = buffer.slice(bodyEnd);
      onMessage(message);
    }
  };
}

function waitFor(messages, predicate, label, timeoutMs = 5000) {
  const existing = messages.find(predicate);
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const interval = setInterval(() => {
      const match = messages.find(predicate);
      if (match) {
        clearInterval(interval);
        resolve(match);
        return;
      }

      if (Date.now() - started > timeoutMs) {
        clearInterval(interval);
        reject(new Error(`Timed out waiting for ${label}`));
      }
    }, 25);
  });
}

async function main() {
  const server = spawn(process.execPath, [SERVER_PATH, "--stdio"], {
    cwd: REPO_ROOT,
    stdio: ["pipe", "pipe", "pipe"]
  });

  const messages = [];
  let stderr = "";

  server.stdout.on("data", createParser((message) => {
    messages.push(message);
  }));
  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  function send(message) {
    server.stdin.write(encode(message));
  }

  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      processId: process.pid,
      rootUri: `file://${REPO_ROOT}`,
      capabilities: {}
    }
  });

  const initialize = await waitFor(messages, (message) => message.id === 1, "initialize response");
  assert.equal(initialize.result.capabilities.hoverProvider, true);
  assert.equal(initialize.result.capabilities.completionProvider.triggerCharacters.includes("="), true);
  assert.equal(initialize.result.capabilities.documentFormattingProvider, true);

  send({ jsonrpc: "2.0", method: "initialized", params: {} });

  const uri = "file:///tmp/lsp-smoke.bhv";
  const text = [
    "Behavior = BHV_AbortToPoint",
    "{",
    "  speed = fast",
    "}"
  ].join("\n");

  send({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: {
      textDocument: {
        uri,
        languageId: "ivp-behavior",
        version: 1,
        text
      }
    }
  });

  const diagnostics = await waitFor(
    messages,
    (message) => message.method === "textDocument/publishDiagnostics" && message.params.uri === uri,
    "diagnostics notification"
  );
  assert.equal(diagnostics.params.diagnostics.some((diagnostic) => diagnostic.message.includes("speed")), true);

  send({
    jsonrpc: "2.0",
    id: 2,
    method: "textDocument/hover",
    params: {
      textDocument: { uri },
      position: { line: 2, character: 4 }
    }
  });

  const hover = await waitFor(messages, (message) => message.id === 2, "hover response");
  assert.match(hover.result.contents.value, /speed/i);

  send({
    jsonrpc: "2.0",
    id: 5,
    method: "textDocument/completion",
    params: {
      textDocument: { uri },
      position: { line: 2, character: 4 }
    }
  });

  const completion = await waitFor(messages, (message) => message.id === 5, "completion response");
  assert.equal(completion.result.some((item) => item.label === "speed"), true);

  send({
    jsonrpc: "2.0",
    id: 3,
    method: "textDocument/formatting",
    params: {
      textDocument: { uri },
      options: { tabSize: 2, insertSpaces: true }
    }
  });

  const formatting = await waitFor(messages, (message) => message.id === 3, "formatting response");
  assert.equal(Array.isArray(formatting.result), true);

  send({ jsonrpc: "2.0", id: 4, method: "shutdown", params: null });
  await waitFor(messages, (message) => message.id === 4, "shutdown response");
  send({ jsonrpc: "2.0", method: "exit", params: null });

  await new Promise((resolve) => {
    server.once("exit", resolve);
    setTimeout(resolve, 1000);
  });

  if (server.exitCode && server.exitCode !== 0) {
    throw new Error(`server exited with ${server.exitCode}: ${stderr}`);
  }

  console.log("server smoke test passed");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
