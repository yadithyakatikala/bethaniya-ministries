import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('mobile/src/i18n/strings.ts','utf8');
// Pull the two catalogue object literals.
function catalogue(name){
  const start = src.indexOf(`const ${name}: Strings = {`);
  const end = src.indexOf('\n};', start);
  const body = src.slice(start, end);
  const out = {};
  for (const m of body.matchAll(/^  '([^']+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,$/gm)) {
    out[m[1]] = (m[2] ?? m[3]).replace(/\\'/g, "'").replace(/\\"/g,'"').replace(/\\u([0-9a-fA-F]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
  }
  return out;
}
const en = catalogue('en'), te = catalogue('te');
const keys = Object.keys(en);
if (keys.length !== Object.keys(te).length) throw new Error('catalogue size mismatch');

const UNCERTAIN = {
  'home.liveNow': 'Literally "live broadcast". If the congregation says something else for a live stream, change it.',
  'more.community': '"సమాజం" can read as "society/community" broadly. Confirm it is the word used for the church community feed.',
  'settings.title': 'Kept in Telugu. If members are used to the English "Settings", switch this and `more.settings` together.',
  'profile.title': 'Transliterated ("ప్రొఫైల్"). A native Telugu word may be preferred.',
  'nav.home': 'Transliterated ("హోమ్"). Consider "ముఖపేజీ" if a native term is preferred.',
  'nav.bible': 'Transliterated ("బైబిల్") -- standard in Telugu Christian usage, please confirm.',
  'plans.title': '"పఠన ప్రణాళికలు" is literal. Confirm the church’s own term for a reading plan.',
  'prayers.markAnswered': 'Long. A shorter phrase may fit the row better on a narrow phone.',
  'settings.switchTo': 'Used both as a button label and inside an accessibility sentence -- check it reads naturally in both.',
  'auth.signIn': 'Transliteration ("సైన్ ఇన్") vs a native phrase -- pick one and keep it consistent with `auth.createAccount`.',
};

const groups = {};
for (const k of keys) {
  const g = k.split('.')[0];
  (groups[g] ??= []).push(k);
}

let md = `# Telugu translation review

**Status: DRAFTED BY THE DEVELOPMENT PASS, NOT YET REVIEWED BY A TELUGU SPEAKER.**

These strings were written during the V1 tester-feedback pass so that
choosing Telugu actually changes the app's interface, which it previously
did not. They have **not** been checked by a native Telugu speaker, and
they are **not** professionally translated. Treat this document as the
release-review artifact: a Telugu-speaking member of Bethaniya Ministries
should read the table below and correct anything that is wrong, awkward
or simply not how the congregation speaks.

## How to apply corrections

Every string lives in one file: \`mobile/src/i18n/strings.ts\`. Find the
key in the \`te\` catalogue and change its value. Nothing else needs to
change -- the key stays the same, and the app picks the new wording up on
the next build. English is in the \`en\` catalogue in the same file.

A missing Telugu string is a **compile error**, not a silent fallback, so
a key cannot be accidentally dropped while editing.

## Conventions used

- **Consistency over variety.** A term is translated the same way
  everywhere: "Settings" is always \`సెట్టింగ్‌లు\`, "Profile" always
  \`ప్రొఫైల్\`, "Community" always \`సమాజం\`. If you change one, change
  every occurrence (they share a key wherever possible).
- **The church's own name stays in English** (\`Bethaniya Ministries\`),
  as it appears in the logo.
- **Product names stay in English**: Google, Apple, YouTube.
- **Transliteration is used** where Telugu Christian usage commonly
  transliterates (\`బైబిల్\`, \`సైన్ ఇన్\`). Several of these are flagged
  below as worth a second opinion.
- **Internal identifiers are never translated** and are not in this
  table: Bible book ids, Firestore field names, role values, test ids.
  Bible BOOK NAMES *are* translated, but they come from a licensed
  source rather than from this file -- see \`BIBLE_LICENSING.md\`.

## Terms flagged as uncertain

| Key | Telugu | Why it needs a second opinion |
| --- | --- | --- |
`;
for (const [k, note] of Object.entries(UNCERTAIN)) {
  if (!te[k]) continue;
  md += `| \`${k}\` | ${te[k]} | ${note} |\n`;
}

md += `\n## Every string\n\n${keys.length} keys, grouped by screen area.\n`;
const titles = {
  nav: 'Bottom navigation', common: 'Common actions', home: 'Home', bible: 'Bible',
  songs: 'Songs', events: 'Events', more: 'More', plans: 'Reading plans',
  prayers: 'Prayers', community: 'Community', announcements: 'Announcements',
  dailyVerse: 'Daily verse', notifications: 'Notifications', auth: 'Sign in / sign up',
  profile: 'Profile', settings: 'Settings',
};
for (const [g, gk] of Object.entries(groups)) {
  md += `\n### ${titles[g] ?? g}\n\n| Key | English | Telugu | |\n| --- | --- | --- | --- |\n`;
  for (const k of gk) {
    const flag = UNCERTAIN[k] ? '⚠️' : '';
    const esc = (v) => v.replace(/\|/g, '\\|');
    md += `| \`${k}\` | ${esc(en[k])} | ${esc(te[k])} | ${flag} |\n`;
  }
}
md += `\n---\n\nGenerated from \`mobile/src/i18n/strings.ts\`. Regenerate after editing:\n\n\`\`\`\nnode scripts/gen-telugu-review.mjs\n\`\`\`\n`;
writeFileSync('TELUGU_REVIEW.md', md);
console.log(`wrote TELUGU_REVIEW.md -- ${keys.length} keys, ${Object.keys(UNCERTAIN).length} flagged`);
