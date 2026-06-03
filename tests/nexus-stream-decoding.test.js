/* nexus-stream-decoding · regression test
 *
 * Guards the fix for the Nexus "itiden"-style text-corruption glitch. The root
 * cause was a client SSE-decode bug: the read loop used
 * `decoder.decode(value).split('\n')` per read, with NO persistent buffer and
 * NO `{ stream: true }`. Network read() boundaries are not aligned to SSE
 * `data:` line boundaries, so any `data:` line — or any multi-byte UTF-8 char
 * (em-dash, curly quotes) — that straddled two reads was mis-decoded or failed
 * JSON.parse and got silently dropped by the `catch`.
 *
 * The fix ports the buffered pattern already used elsewhere in index.html:
 *   • a persistent `buffer` accumulated across reads,
 *   • `decoder.decode(value, { stream: true })`,
 *   • `buffer = lines.pop()` to retain the incomplete trailing line,
 *   • a final `decoder.decode()` flush on `done`.
 * The accumulator render (`text += d.chunk; bubble.textContent = text`) is
 * preserved — a full replace from an accumulator, never a DOM append.
 *
 * Sections:
 *   1. static — Nexus loop uses buffer + {stream:true} + lines.pop + flush
 *   2. static — both inspire/suggestion loops use the same buffered pattern
 *   3. static — render stays an accumulator full-replace (no append regression)
 *   4. dynamic — a mock chunked stream that splits a data: line and multi-byte
 *      chars across reads reassembles to the exact original text
 *
 *   Run: node tests/nexus-stream-decoding.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}

// ---------------------------------------------------------------------------
console.log('1. Nexus sendCompassNexusMessage() loop — buffered streaming decode');
// ---------------------------------------------------------------------------
const sendFn = (index.match(/async function sendCompassNexusMessage[\s\S]*?\n\}\n/) || [''])[0];
ok('sendCompassNexusMessage() is found', !!sendFn);
ok('declares a persistent decode buffer', /let buffer = '';/.test(sendFn));
ok('decodes with { stream: true }',
   /decoder\.decode\(value, \{ stream: true \}\)/.test(sendFn));
ok('retains the incomplete trailing line via lines.pop()',
   /buffer = lines\.pop\(\)/.test(sendFn));
ok('flushes the streaming decoder on done (decoder.decode())',
   /buffer \+= decoder\.decode\(\);/.test(sendFn));
ok('the old per-read decode().split() pattern is gone from the Nexus loop',
   !/decoder\.decode\(value\)\.split\('\\n'\)/.test(sendFn));

// ---------------------------------------------------------------------------
console.log('\n2. inspire/suggestion loops — same buffered pattern');
// ---------------------------------------------------------------------------
// Both /inspire and /inspire-layer2 streamed loops must use the buffered
// decode too (no leftover per-read decode().split() anywhere in the file).
ok('no decoder.decode(value).split() per-read pattern remains anywhere',
   !/decoder\.decode\(value\)\.split\(/.test(index));
ok('at least three buffered Nexus/inspire loops flush on done',
   (index.match(/buffer \+= decoder\.decode\(\);/g) || []).length >= 3);
ok('at least three loops keep the trailing partial line (lines.pop)',
   (index.match(/buffer = lines\.pop\(\)/g) || []).length >= 3);

// ---------------------------------------------------------------------------
console.log('\n3. render stays an accumulator full-replace (no DOM append)');
// ---------------------------------------------------------------------------
ok('Nexus render accumulates then full-replaces (text += / bubble.textContent = text)',
   /text \+= d\.chunk;\s*bubble\.textContent = text;/.test(sendFn));
ok('Nexus render does NOT append text nodes to the bubble',
   !/bubble\.appendChild/.test(sendFn) &&
   !/bubble\.insertAdjacent/.test(sendFn));
ok('inspire loop accumulates then assigns (accumulated += / textContent = accumulated)',
   /accumulated \+= data\.chunk;[\s\S]{0,80}textContent = accumulated;/.test(index));

// ---------------------------------------------------------------------------
console.log('\n4. dynamic — chunked stream with split data: line + multi-byte chars');
// ---------------------------------------------------------------------------
// Reimplement the EXACT buffered loop logic against a mock reader. This proves
// the algorithm itself reassembles a `data:` JSON line and a multi-byte UTF-8
// char that have been deliberately split across read() boundaries — including
// at a byte boundary INSIDE a multi-byte char (the em-dash / curly-quote case
// that produced the "itiden" glitch).
(function dynamic() {
  const original =
    'Yes — by building it widen the field, and you’ll feel the “shift” settle in.';
  // SSE wire form: one data: line carrying the JSON chunk, then a done line.
  const wire =
    'data: ' + JSON.stringify({ chunk: original }) + '\n\n' +
    'data: ' + JSON.stringify({ done: true }) + '\n\n';

  // Encode to bytes, then slice into many small, deliberately misaligned reads
  // so that data: lines AND multi-byte UTF-8 sequences straddle chunk edges.
  const bytes = new TextEncoder().encode(wire);
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 7) {
    chunks.push(bytes.subarray(i, Math.min(i + 7, bytes.length)));
  }

  // Mock reader mirroring res.body.getReader().
  let ci = 0;
  const reader = {
    read() {
      if (ci < chunks.length) return Promise.resolve({ done: false, value: chunks[ci++] });
      return Promise.resolve({ done: true, value: undefined });
    },
  };

  // --- The loop under test (mirrors the fixed index.html logic) ---
  const decoder = new TextDecoder();
  let text = '';
  let buffer = '';
  function handleLine(line) {
    if (!line.startsWith('data: ')) return;
    try {
      const d = JSON.parse(line.slice(6));
      if (d.chunk) { text += d.chunk; }
    } catch (_) {}
  }
  return new Promise((resolve) => {
    function read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          buffer += decoder.decode();
          if (buffer) { handleLine(buffer); buffer = ''; }
          resolve();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) handleLine(line);
        read();
      });
    }
    read();
  }).then(() => {
    ok('assembled text exactly equals the original (no dropped/garbled chars)',
       text === original);
    ok('the "building it widen the field" phrase is intact',
       text.includes('building it widen the field'));
    ok('the em-dash survives the split read', text.includes('—'));
    ok('the curly quotes survive the split read',
       text.includes('’') && text.includes('“') && text.includes('”'));

    // Sanity: prove the OLD (buggy) per-read decode WOULD have corrupted this,
    // so the dynamic test is actually exercising the failure mode.
    let buggy = '';
    const d2 = new TextDecoder();
    for (const c of chunks) {
      d2.decode(c).split('\n').forEach((line) => {        // no buffer, no {stream:true}
        if (!line.startsWith('data: ')) return;
        try { const j = JSON.parse(line.slice(6)); if (j.chunk) buggy += j.chunk; } catch (_) {}
      });
    }
    ok('the old per-read decode would have corrupted/dropped this text (failure mode confirmed)',
       buggy !== original);

    if (failed) {
      console.error('\nFAILED: ' + failed + ' check(s).');
      process.exit(1);
    } else {
      console.log('\nOK: Nexus stream-decoding regressions pass.');
    }
  });
})();
