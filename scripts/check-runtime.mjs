/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import ts from "typescript";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Inspect executable syntax, not comments, strings or embedded binary text. */
export function inspectRuntime(source) {
  const result = { network: 0, dynamicCode: 0, browserBinaryCodecs: 0 };
  const tree = ts.createSourceFile(
    "main.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const name = (node) =>
    ts.isIdentifier(node)
      ? node.text
      : ts.isPropertyAccessExpression(node)
        ? node.name.text
        : ts.isElementAccessExpression(node) &&
            ts.isStringLiteral(node.argumentExpression)
          ? node.argumentExpression.text
          : undefined;
  const aliases = {
    network: new Set([
      "fetch",
      "request",
      "requestUrl",
      "XMLHttpRequest",
      "WebSocket",
      "EventSource",
    ]),
    dynamicCode: new Set(["eval", "Function"]),
    browserBinaryCodecs: new Set(["atob", "btoa"]),
  };
  const options = { allowJs: true, noLib: true, noResolve: true };
  const host = {
    ...ts.createCompilerHost(options),
    getSourceFile: (file) => (file === "main.js" ? tree : undefined),
    readFile: () => undefined,
    fileExists: (file) => file === "main.js",
  };
  const checker = ts.createProgram(["main.js"], options, host).getTypeChecker();
  const symbolAliases = new Map();
  function capabilities(node) {
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol) return symbolAliases.get(symbol) ?? [];
    }
    return Object.entries(aliases)
      .filter(([, names]) => names.has(name(node)))
      .map(([kind]) => kind);
  }
  let changed;
  do {
    changed = false;
    function collect(node) {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      ) {
        const symbol = checker.getSymbolAtLocation(node.name);
        const known = symbolAliases.get(symbol) ?? new Set();
        for (const kind of capabilities(node.initializer))
          if (!known.has(kind)) {
            known.add(kind);
            changed = true;
          }
        symbolAliases.set(symbol, known);
      }
      ts.forEachChild(node, collect);
    }
    collect(tree);
  } while (changed);
  function visit(node) {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      for (const kind of capabilities(node.expression)) result[kind]++;
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return result;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = inspectRuntime(await readFile("main.js", "utf8"));
  console.log(
    "Executable runtime capability inventory:",
    JSON.stringify(result),
  );
  if (result.network || result.dynamicCode || result.browserBinaryCodecs)
    throw new Error(
      "Review the reintroduced network, dynamic-code or browser base64 capability before release.",
    );
}
