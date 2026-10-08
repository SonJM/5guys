import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/openai.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { structuredCompletion } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

const options = {
  name: "shift_rows",
  schema: {
    type: "object",
    properties: { rows: { type: "array", items: { type: "string" } } },
    required: ["rows"],
    additionalProperties: false,
  },
  instructions: "Return rows.",
  input: "N on Monday",
  maxOutputTokens: 300,
  timeoutMs: 1000,
};

test("OpenAI request uses a server key, low-cost model, and strict output schema", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: '{"rows":["N"]}' } }],
    }), { status: 200 });
  };
  try {
    assert.deepEqual(await structuredCompletion(options), { rows: ["N"] });
    assert.equal(request.url, "https://api.openai.com/v1/chat/completions");
    assert.equal(request.init.headers.Authorization, "Bearer test-key");
    const body = JSON.parse(request.init.body);
    assert.equal(body.model, "gpt-6-luna");
    assert.equal(body.reasoning_effort, "none");
    assert.equal(body.store, false);
    assert.equal(body.response_format.json_schema.strict, true);
    assert.deepEqual(body.response_format.json_schema.schema, options.schema);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("OpenAI missing key and exhausted credits have actionable errors", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(structuredCompletion(options), /연결 설정/);
    process.env.OPENAI_API_KEY = "test-key";
    globalThis.fetch = async () => new Response(JSON.stringify({
      error: { code: "credit_balance_exhausted" },
    }), { status: 429 });
    await assert.rejects(structuredCompletion(options), /크레딧/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
