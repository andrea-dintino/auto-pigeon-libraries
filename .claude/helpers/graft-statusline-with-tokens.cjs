#!/usr/bin/env node

// Preserve Graft's generated status line and append Claude Code token counts.
// Kept separate because Graft owns and may regenerate graft-statusline.cjs.

const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

let raw = '';
let data = {};

try {
  raw = readFileSync(0, 'utf8');
  data = JSON.parse(raw);
} catch {
  // Claude may invoke the status line before complete data is available.
}

const projectDir =
  process.env.CLAUDE_PROJECT_DIR ||
  data?.workspace?.project_dir ||
  data?.cwd ||
  process.cwd();

const graftHelper = join(
  projectDir,
  '.claude',
  'helpers',
  'graft-statusline.cjs',
);

const graft = spawnSync(process.execPath, [graftHelper], {
  input: raw,
  encoding: 'utf8',
  env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  timeout: 3000,
  windowsHide: true,
});

const graftOutput = typeof graft.stdout === 'string'
  ? graft.stdout.trimEnd()
  : '';

if (graftOutput) {
  process.stdout.write(`${graftOutput}\n`);
}

const context = data?.context_window ?? {};
const usage = context.current_usage ?? {};

const inputTokens = Number.isFinite(context.total_input_tokens)
  ? context.total_input_tokens
  : (Number(usage.input_tokens) || 0) +
    (Number(usage.cache_creation_input_tokens) || 0) +
    (Number(usage.cache_read_input_tokens) || 0);

const outputTokens = Number.isFinite(context.total_output_tokens)
  ? context.total_output_tokens
  : Number(usage.output_tokens) || 0;

const formatTokens = (value) =>
  Math.max(0, Number(value) || 0).toLocaleString('en-US');

process.stdout.write(
  `▸ in ${formatTokens(inputTokens)} tok · out ${formatTokens(outputTokens)} tok`,
);
