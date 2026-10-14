import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('mobile/src/i18n/strings.ts','utf8');
// Pull the two catalogue object literals.
function catalogue(name){
  const start = src.indexOf(`const ${name}: Strings = {`);
  const end = src.indexOf('\n};', start);
  const body = src.slice(start, end);
  const out = {};
  for (const m of body.matchAll(/^  '([^']+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,$/gm)) {
    out[m[1]] = (m[2] ?? m[3]).replace(/\\'/g, "'").replace(/\\"/g,'"').replace(/\\u([0-9a-fA-F]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16)))
      // a hand-set heading break: one line in a table cell, shown as a break
      .replace(/\\n/g, '<br>');
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
  'onboarding.q2': 'The five onboarding questions were drafted by the development pass (the approved design showed only the first and last in Telugu). Check each reads as a natural thing to be asked.',
  'onboarding.s2': 'The English sentence ("It helps the church know who it is serving.") is itself a draft for the church to confirm; the Telugu follows it. It is the stated purpose of collecting an age.',
  'onboarding.ageUnit': 'Added by the development pass: the approved design showed no unit after the age in Telugu. "సంవత్సరాలు" ("years") is a guess; "ఏళ్లు" is the usual spoken form.',
  'onboarding.q4': 'Asks how the member identifies and offers the two values the church asked for. Check the wording is respectful and natural, and that "పురుషుడు" / "స్త్రీ" are the words the congregation would choose.',
  'onboarding.skipQuestion': 'Deliberately NOT the same words as `onboarding.skip` ("Not now"): that one leaves the questions altogether; this one skips only the phone number. Check the two read as different things.',
  'home.readChapter': 'The primary button under the Verse of the Day. "అధ్యాయం" is "chapter"; check "చదవండి" ("read") is the verb the congregation uses on a button.',
  'home.together': 'A one-word title over Prayer requests, Church chat and Photos and videos. Confirm "కలిసి" ("together") reads as "together as a church", not only as the adverb.',
  'home.askPray': 'A full sentence under "Prayer requests" on Home. Check the polite plural register is how the church speaks to its members.',
  'home.updatesLabel': 'Read aloud by a screen reader on Home\'s header button, which opens announcements and posts. "సమాచారం" is a broad word for "information"; confirm it is the church\'s word for updates.',
  'prophetVerse.readMore': 'The control under a long Prophet Verse; it pairs with `prophetVerse.showLess`. Check the two read naturally as a pair.',
  'nav.prayers': 'The tab for prayer requests and the private journal. Confirm the plural "ప్రార్థనలు" reads as the place for both.',
  'nav.you': '"మీరు" ("you", polite) names the member\'s own corner: their saved things, profile and settings. Confirm it reads as that and not as a form of address.',
  'prayers.tabRequests': '"విన్నపాలు" ("petitions"). Confirm it is the word members use for a prayer request.',
  'prayers.tabJournal': 'Literally "my book". Confirm it reads as a prayer journal; "నా ప్రార్థన పుస్తకం" may be clearer, at more width.',
  'prayers.shared': 'The passive "పంచుకోబడింది" ("was shared") is formal; a simpler spoken form may be preferred.',
  'community.tabUpdates': 'The same word as Home\'s Updates button (`home.updatesLabel`); keep the two the same.',
  'you.tabSaved': '"భద్రపరచినవి" ("things kept safe"). Confirm it reads as "saved".',
  'prayerWall.anonymousHelp': 'A PRIVACY statement members rely on. Check it says plainly who can and cannot see a name: other members and the church team cannot; the church\'s main administrator can, only to deal with a report.',
  'report.intro': 'A promise that the reporter\'s name is not shown to other members. Check the wording is plain and exact.',
  'songs.noFavouritesMessage': 'Tells a member how to add a favourite: choose the "Favourite" button on a song. It quotes the button\'s own label (`songs.favoriteAction`, "ఇష్టమైనది"); keep the two the same word.',
  'songs.progress': 'Spoken by a screen reader for the song\'s progress line ("Song progress", then the time played and the length). A natural spoken phrase is wanted.',
  'events.today': 'Replaces the date on an event that starts today ("ఈరోజు, 10:30 AM"). Check it reads naturally before a time.',
  'profile.age': '"వయస్సు" ("age"). The label of the row that shows the number of years a member gave.',
  'settings.logOutConfirmTitle': 'Asks before signing out and names the app ("మరనాథ"). Check the app\'s name is written the way the church writes it in Telugu.',
  'settings.logOutConfirmMessage': 'Reassures the member that nothing is deleted when they log out. Check it reads as reassurance, not as a warning.',
  'credits.intro': 'Says the Bibles are stored on the phone and work without a connection.',
  'credits.publicDomain': 'The English Bible\'s status. "ప్రజా వినియోగ హక్కు (పబ్లిక్ డొమైన్)" is long; a shorter accepted term may be preferred.',
  'credits.licensed': 'The licence line the Telugu Bible\'s terms require (CC BY-SA 4.0). Keep the licence name exactly as it is.',
  'notifications.new': 'Spoken before an unread notification by a screen reader ("కొత్తది", "a new one"). Check it reads naturally before a title.',
  'notifications.emptyMessage': 'The empty Notifications page: says where a church notification is kept.',
  'plans.myPlans': 'The chip for the plans a member has started. "నా ప్రణాళికలు" ("my plans"); keep it consistent with `plans.title`.',
  'plans.findPlans': 'The chip for plans not yet started. A single verb, "కనుగొనండి" ("find"), to fit a chip; confirm it reads as "find plans" and not just "find".',
  'plans.beginWithPlan': 'A short invitation under "Start a plan" when a member has none. Drafted; check the tone is warm, not pushy.',
  'plans.reflect': '"ధ్యానించండి" ("meditate"). The second of three steps in a plan day (Read, Reflect, Pray); confirm it is the verb the church uses for reflecting on a passage.',
  'plans.doneMessage': 'The sentence on "Plan complete": "{plan} యొక్క {n} రోజులూ మీరు చదివారు." Check the order of the name and the number reads naturally.',
  'plans.question': '"ఆలోచించండి" ("think about it"). The heading over a plan day\'s reflection question (a question to ponder after reading). Confirm it reads as an invitation to reflect, not as a command.',
  'plans.application': '"ఆచరణలో పెట్టండి" ("put into practice"). The heading over the day\'s suggestion for living the reading out. Confirm the church\'s own phrase.',
  'plans.notes': '"గమనికలు" ("notes"). The heading over background notes the church adds to a day. It is not the member\'s own notes (`you.notes`, "నోట్‌లు"); check the two are clearly different.',
  'plans.minutesPerDay': '"రోజుకు {n} నిమిషాలు" ("{n} minutes a day"), shown beside a plan\'s length. Keep {n} as it is.',
  'plans.byAuthor': '"{author} రచన" ("written by {author}"). Keep {author} as it is; check the order reads naturally with a person\'s name.',
  'plans.nextDay': '"తదుపరి: {n}వ రోజు" ("Next: day {n}"). Check the ordinal ending "వ" after a number reads correctly for every day.',
  'bible.pageSepia': 'A page colour, transliterated ("సెపియా"). Confirm members would recognise it, or choose a native word for a warm cream page.',
  'bible.page': '"పేజీ" ("page"): the label over the three page choices (Light, Sepia, Dark) in the reading settings.',
  'bible.moreSettings': '"మరిన్ని అమరికలు": opens the rest of the reading settings. `settings.title` uses "సెట్టింగ్‌లు" for Settings; decide whether this should use the same word.',
  'onboarding.chapterSkip': 'Read aloud by a screen reader on the introduction animation. Check it is clear that it skips the animation, not the questions.',
  'auth.show': 'The small text action inside the password box ("చూపించు", "show"); it pairs with `auth.hide`. Check both read naturally as one-word buttons.',
  'auth.hide': 'The same action once the password is showing ("దాచు", "hide"). Pairs with `auth.show`.',
  'auth.passwordHint': 'Under the password box when creating an account: how short a password may be. "కనీసం {min} అక్షరాలు" ("at least {min} letters"). Keep {min} as it is.',
  'dailyVerse.archiveError': 'Said in place of the list of earlier verses when it could not be loaded. Keep it parallel to `dailyVerse.unavailable`.',
  'legal.provisional': 'Says the Privacy Policy and Terms have not yet been reviewed by the church\'s counsel. It is a statement about a LEGAL text: check it is exact and not alarming.',
  'legal.englishOnly': 'Added after `legal.provisional` under a Telugu interface, because the legal text itself is English only for now. Stop using it once a Telugu text has been approved.',
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
  profile: 'Profile', settings: 'Settings', onboarding: 'First sign-in questions', opening: 'Opening animation',
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
