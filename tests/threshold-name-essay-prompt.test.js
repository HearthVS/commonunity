/* Threshold name-essay prompt · specificity regression
 *
 * After early-user feedback that name essays were drifting into
 * generic identity prose, the prompt was tightened to demand
 * name-specific depth and equal dignity for non-Western names.
 * This test pins the new clauses so a future prompt edit cannot
 * silently revert them.
 *
 * It is a literal text check against server.py — we don't call
 * the model. The constraint that survives here is the WORDING the
 * prompt promises to the model, not the model's output.
 *
 *   Run: node tests/threshold-name-essay-prompt.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const serverPy = fs.readFileSync(
  path.join(__dirname, '..', 'server.py'),
  'utf8'
);

// Extract the NAME_ESSAY_SYSTEM triple-quoted string so we test
// the actual prompt text and not other server.py content.
const promptMatch = serverPy.match(/NAME_ESSAY_SYSTEM\s*=\s*"""([\s\S]*?)"""/);
if (!promptMatch) {
  console.error('FAIL: could not locate NAME_ESSAY_SYSTEM in server.py');
  process.exit(1);
}
const prompt = promptMatch[1];

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { console.log('  ok  ' + label); pass++; }
  else      { console.log('  FAIL ' + label); fail++; }
}

console.log('1. preserved invariants (must not be lost when tightening)');
ok(/300[–-]400 words/.test(prompt),
   "essay length constraint (300-400 words) still present");
ok(/given \(first\) name as the primary subject/i.test(prompt),
   "given name only is the primary subject (no surname analysis)");
ok(/Do not analyze, interpret, or speculate about the surname/i.test(prompt),
   "explicit no-surname-analysis clause is present");
ok(/Return only the essay text, ready to display in the app/.test(prompt),
   "output-only-essay-text instruction is preserved");
ok(/horoscope language|astrology shorthand/i.test(prompt),
   "horoscope/astrology avoidance is preserved");
ok(/inspirational fluff/i.test(prompt),
   "inspirational-fluff avoidance is preserved");
ok(/[Tt]herapy clich[eé]s/.test(prompt),
   "therapy-clichés avoidance is preserved");
ok(/[Nn]ew-age excess|pseudo-mystical/.test(prompt),
   "new-age excess avoidance is preserved");
ok(/Mechanistic|analytical phrases/i.test(prompt),
   "mechanistic-phrase avoidance is preserved");
ok(/Overconfident factual claims about uncertain etymology/i.test(prompt),
   "overconfident-etymology avoidance is preserved");
ok(/Do not mention the person's age/i.test(prompt),
   "no-age-mention rule is preserved");
ok(/at least one sentence that feels singular and memorable/i.test(prompt),
   "at-least-one-singular-sentence rule is preserved");

console.log('\n2. new specificity guidance (the point of this update)');
ok(/[Aa]nchor the essay primarily in THIS given name/.test(prompt),
   "essay is anchored in THIS given name, not names in general");
ok(/At least half of the essay must be dedicated to the specific given name/i.test(prompt),
   "at-least-half-of-essay must be on the specific given name");
ok(/2[\s-]?(?:to[\s-]?)?4 concrete name-specific details/i.test(prompt),
   "2-4 concrete name-specific details requirement is present");
ok(/likely meaning|likely roots/i.test(prompt),
   "likely meanings/roots are named as concrete details");
ok(/language and cultural associations|linguistic and cultural associations|language or cultural origin/i.test(prompt),
   "linguistic/cultural associations are named as concrete details");
ok(/historical evolution|historical or regional movement|movement across languages/i.test(prompt),
   "historical/regional movement is named as a concrete detail");
ok(/variants and related forms|variants\/related forms/i.test(prompt),
   "variants and related forms are named as concrete details");

console.log('\n3. non-Western / less-familiar name dignity');
ok(/Turkish/.test(prompt),
   "Turkish is named explicitly as an example of less-Western-represented names");
ok(/non-Western|less common in English-language sources|less familiar/i.test(prompt),
   "non-Western / less-common-in-English / less-familiar guidance is present");
ok(/never feel left out because their name is less represented/i.test(prompt),
   "explicit assurance: person never feels left out because their name is less represented");
ok(/equal richness and dignity|same depth of attention/i.test(prompt),
   "equal richness/dignity for less-represented names is required");

console.log('\n4. humble-but-specific language guidance');
ok(/this name is associated with|one thread of the name moves through|in some traditions this name carries/i.test(prompt),
   "humble-but-specific exemplar phrasings are present");
ok(/still provide concrete specificity/i.test(prompt),
   "humble-language clause still demands concrete specificity (no retreat into abstraction)");

console.log('\n5. arc structure (rough thirds: lived → name history → reflection)');
ok(/[Ff]irst third[\s\S]{0,200}lived presence/.test(prompt),
   "first-third covers lived presence of the name");
ok(/[Mm]iddle third[\s\S]{0,400}(name-specific history|roots and likely meanings|languages and cultures it has moved through)/.test(prompt),
   "middle-third is the name-specific history/meaning/movement section");
ok(/[Ff]inal third[\s\S]{0,300}(reflection and self-recognition|mirror idea)/.test(prompt),
   "final-third is reflection/self-recognition");

console.log('\n6. anti-drift clause');
ok(/Do not let the essay become mostly a general meditation on identity|Keep returning to the actual given name/i.test(prompt),
   "explicit clause forbidding drift into general identity meditation");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
