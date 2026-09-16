# Telugu translation review

**Status: DRAFTED BY THE DEVELOPMENT PASS, NOT YET REVIEWED BY A TELUGU SPEAKER.**

These strings were written during the V1 tester-feedback pass so that
choosing Telugu actually changes the app's interface, which it previously
did not. They have **not** been checked by a native Telugu speaker, and
they are **not** professionally translated. Treat this document as the
release-review artifact: a Telugu-speaking member of Bethaniya Ministries
should read the table below and correct anything that is wrong, awkward
or simply not how the congregation speaks.

## How to apply corrections

Every string lives in one file: `mobile/src/i18n/strings.ts`. Find the
key in the `te` catalogue and change its value. Nothing else needs to
change -- the key stays the same, and the app picks the new wording up on
the next build. English is in the `en` catalogue in the same file.

A missing Telugu string is a **compile error**, not a silent fallback, so
a key cannot be accidentally dropped while editing.

## Conventions used

- **Consistency over variety.** A term is translated the same way
  everywhere: "Settings" is always `సెట్టింగ్‌లు`, "Profile" always
  `ప్రొఫైల్`, "Community" always `సమాజం`. If you change one, change
  every occurrence (they share a key wherever possible).
- **The church's own name stays in English** (`Bethaniya Ministries`),
  as it appears in the logo.
- **Product names stay in English**: Google, Apple, YouTube.
- **Transliteration is used** where Telugu Christian usage commonly
  transliterates (`బైబిల్`, `సైన్ ఇన్`). Several of these are flagged
  below as worth a second opinion.
- **Internal identifiers are never translated** and are not in this
  table: Bible book ids, Firestore field names, role values, test ids.
  Bible BOOK NAMES *are* translated, but they come from a licensed
  source rather than from this file -- see `BIBLE_LICENSING.md`.

## Terms flagged as uncertain

| Key | Telugu | Why it needs a second opinion |
| --- | --- | --- |
| `home.liveNow` | ప్రత్యక్ష ప్రసారం | Literally "live broadcast". If the congregation says something else for a live stream, change it. |
| `more.community` | సమాజం | "సమాజం" can read as "society/community" broadly. Confirm it is the word used for the church community feed. |
| `settings.title` | సెట్టింగ్‌లు | Kept in Telugu. If members are used to the English "Settings", switch this and `more.settings` together. |
| `profile.title` | ప్రొఫైల్ | Transliterated ("ప్రొఫైల్"). A native Telugu word may be preferred. |
| `nav.home` | హోమ్ | Transliterated ("హోమ్"). Consider "ముఖపేజీ" if a native term is preferred. |
| `nav.bible` | బైబిల్ | Transliterated ("బైబిల్") -- standard in Telugu Christian usage, please confirm. |
| `plans.title` | పఠన ప్రణాళికలు | "పఠన ప్రణాళికలు" is literal. Confirm the church’s own term for a reading plan. |
| `prayers.markAnswered` | జవాబు వచ్చినట్లు గుర్తించండి | Long. A shorter phrase may fit the row better on a narrow phone. |
| `settings.switchTo` | మార్చండి | Used both as a button label and inside an accessibility sentence -- check it reads naturally in both. |
| `auth.signIn` | సైన్ ఇన్ | Transliteration ("సైన్ ఇన్") vs a native phrase -- pick one and keep it consistent with `auth.createAccount`. |

## Every string

170 keys, grouped by screen area.

### Bottom navigation

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `nav.home` | Home | హోమ్ | ⚠️ |
| `nav.bible` | Bible | బైబిల్ | ⚠️ |
| `nav.songs` | Songs | పాటలు |  |
| `nav.events` | Events | కార్యక్రమాలు |  |
| `nav.more` | More | మరిన్ని |  |

### Common actions

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `common.loading` | Loading… | లోడ్ అవుతోంది… |  |
| `common.tryAgain` | Try again | మళ్లీ ప్రయత్నించండి |  |
| `common.save` | Save | సేవ్ చేయండి |  |
| `common.cancel` | Cancel | రద్దు |  |
| `common.delete` | Delete | తొలగించండి |  |
| `common.seeAll` | See all | అన్నీ చూడండి |  |
| `common.back` | Back | వెనుకకు |  |
| `common.search` | Search | వెతకండి |  |

### Home

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `home.welcome` | Welcome | స్వాగతం |  |
| `home.verseOfTheDay` | Verse of the day | నేటి వచనం |  |
| `home.announcements` | Announcements | ప్రకటనలు |  |
| `home.liveNow` | LIVE NOW | ప్రత్యక్ష ప్రసారం | ⚠️ |
| `home.watchLive` | Watch live | ప్రత్యక్షంగా చూడండి |  |
| `home.yourReadingPlan` | Your reading plan | మీ పఠన ప్రణాళిక |  |
| `home.upcomingEvents` | Upcoming events | రాబోయే కార్యక్రమాలు |  |
| `home.continueGrowing` | Continue growing | ఎదుగుతూ ఉండండి |  |
| `home.notificationsLabel` | Open notifications | నోటిఫికేషన్‌లను తెరవండి |  |
| `home.notificationsHint` | Shows the notifications you have received | మీకు వచ్చిన నోటిఫికేషన్‌లను చూపుతుంది |  |
| `home.dayOf` | Day {current} of {total} | {total}లో {current}వ రోజు |  |

### Bible

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `bible.title` | Bible | బైబిల్ |  |
| `bible.oldTestament` | Old Testament | పాత నిబంధన |  |
| `bible.newTestament` | New Testament | క్రొత్త నిబంధన |  |
| `bible.chapters` | Chapters | అధ్యాయాలు |  |
| `bible.chapter` | Chapter | అధ్యాయం |  |
| `bible.searchPlaceholder` | Search the Bible | బైబిల్‌లో వెతకండి |  |
| `bible.searchPrompt` | Enter a search term to find a passage. | వాక్యభాగం కనుగొనడానికి పదం టైప్ చేయండి. |  |
| `bible.noResults` | No results found for “{query}”. | “{query}” కోసం ఫలితాలు లేవు. |  |
| `bible.switchLanguage` | Switch language | భాష మార్చండి |  |
| `bible.placeholderWarning` | Development content — not a real Bible translation | అభివృద్ధి కంటెంట్ — నిజమైన బైబిల్ అనువాదం కాదు |  |
| `bible.previous` | Previous | మునుపటి |  |
| `bible.next` | Next | తదుపరి |  |
| `bible.chapterLoadError` | Could not load this chapter. | ఈ అధ్యాయం లోడ్ చేయలేకపోయాము. |  |
| `bible.chapterNotFound` | Chapter not found. | అధ్యాయం కనబడలేదు. |  |

### Songs

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `songs.title` | Songs | పాటలు |  |
| `songs.empty` | No songs yet | ఇంకా పాటలు లేవు |  |
| `songs.emptyMessage` | Songs added by the church will appear here. | చర్చి చేర్చిన పాటలు ఇక్కడ కనిపిస్తాయి. |  |
| `songs.favorite` | Add to favourites | ఇష్టమైనవిలో చేర్చండి |  |
| `songs.unfavorite` | Remove from favourites | ఇష్టమైనవి నుండి తీసివేయండి |  |
| `songs.play` | Play | ప్లే |  |
| `songs.pause` | Pause | ఆపండి |  |
| `songs.restart` | Restart | మొదటి నుండి |  |
| `songs.audioError` | Could not load this song’s audio. | ఈ పాట ఆడియో లోడ్ చేయలేకపోయాము. |  |
| `songs.loadError` | Could not load songs. | పాటలు లోడ్ చేయలేకపోయాము. |  |
| `songs.emptyShort` | No songs yet. | ఇంకా పాటలు లేవు. |  |

### Events

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `events.title` | Events | కార్యక్రమాలు |  |
| `events.empty` | No events yet | ఇంకా కార్యక్రమాలు లేవు |  |
| `events.emptyMessage` | Upcoming services and events will appear here. | రాబోయే ఆరాధనలు, కార్యక్రమాలు ఇక్కడ కనిపిస్తాయి. |  |
| `events.live` | LIVE | ప్రత్యక్షం |  |
| `events.watchOnYouTube` | Watch live on YouTube | YouTubeలో ప్రత్యక్షంగా చూడండి |  |
| `events.loadError` | Couldn’t load events. Check your connection and try again. | కార్యక్రమాలు లోడ్ కాలేదు. కనెక్షన్ చూసి మళ్లీ ప్రయత్నించండి. |  |
| `events.loadErrorShort` | Could not load events. | కార్యక్రమాలు లోడ్ చేయలేకపోయాము. |  |
| `events.openInMaps` | Open in Maps | మ్యాప్స్‌లో తెరవండి |  |
| `events.emptyShort` | No upcoming events. | రాబోయే కార్యక్రమాలు లేవు. |  |

### More

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `more.title` | More | మరిన్ని |  |
| `more.grow` | Grow | ఎదుగుదల |  |
| `more.general` | General | సాధారణం |  |
| `more.viewProfile` | View profile | ప్రొఫైల్ చూడండి |  |
| `more.readingPlans` | Reading Plans | పఠన ప్రణాళికలు |  |
| `more.prayers` | Prayers | ప్రార్థనలు |  |
| `more.community` | Community | సమాజం | ⚠️ |
| `more.notifications` | Notifications | నోటిఫికేషన్‌లు |  |
| `more.settings` | Settings | సెట్టింగ్‌లు |  |

### Reading plans

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `plans.title` | Reading Plans | పఠన ప్రణాళికలు | ⚠️ |
| `plans.empty` | No reading plans yet | ఇంకా పఠన ప్రణాళికలు లేవు |  |
| `plans.emptyMessage` | Reading plans added by the church will appear here. | చర్చి చేర్చిన పఠన ప్రణాళికలు ఇక్కడ కనిపిస్తాయి. |  |
| `plans.start` | Start Plan | ప్రణాళిక ప్రారంభించండి |  |
| `plans.continue` | Continue | కొనసాగించండి |  |
| `plans.markComplete` | Mark Complete | పూర్తయినట్లు గుర్తించండి |  |
| `plans.completed` | Completed | పూర్తయింది |  |
| `plans.prayerPrompt` | Prayer Prompt | ప్రార్థన సూచన |  |
| `plans.day` | day | రోజు |  |
| `plans.days` | days | రోజులు |  |
| `plans.noReadings` | No readings yet | ఇంకా పఠనాలు లేవు |  |
| `plans.noReadingsMessage` | This plan hasn’t had its daily readings added. | ఈ ప్రణాళికకు రోజువారీ పఠనాలు ఇంకా చేర్చలేదు. |  |
| `plans.loadError` | Couldn’t load this plan | ఈ ప్రణాళిక లోడ్ కాలేదు |  |
| `plans.loadErrorMessage` | Check your connection and open the plan again. | కనెక్షన్ చూసి ప్రణాళికను మళ్లీ తెరవండి. |  |
| `plans.dayNotFound` | This day could not be found. | ఈ రోజు కనబడలేదు. |  |
| `plans.dayLoadError` | This reading couldn’t be loaded. Check your connection and try again. | ఈ పఠనం లోడ్ కాలేదు. కనెక్షన్ చూసి మళ్లీ ప్రయత్నించండి. |  |
| `plans.loadErrorShort` | Could not load reading plans. | పఠన ప్రణాళికలు లోడ్ చేయలేకపోయాము. |  |
| `plans.emptyShort` | No reading plans yet. | ఇంకా పఠన ప్రణాళికలు లేవు. |  |

### Prayers

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `prayers.title` | Prayers | ప్రార్థనలు |  |
| `prayers.newRequest` | New Prayer Request | కొత్త ప్రార్థన అభ్యర్థన |  |
| `prayers.placeholder` | What’s on your heart? | మీ హృదయంలో ఏముంది? |  |
| `prayers.add` | Add Prayer | ప్రార్థన చేర్చండి |  |
| `prayers.empty` | No prayers yet | ఇంకా ప్రార్థనలు లేవు |  |
| `prayers.emptyMessage` | Add a prayer request above — only you can see it. | పైన ప్రార్థన అభ్యర్థన చేర్చండి — మీకు మాత్రమే కనిపిస్తుంది. |  |
| `prayers.loadError` | Couldn’t load prayers | ప్రార్థనలు లోడ్ కాలేదు |  |
| `prayers.loadErrorMessage` | Check your connection and try again. | కనెక్షన్ చూసి మళ్లీ ప్రయత్నించండి. |  |
| `prayers.markAnswered` | Mark answered | జవాబు వచ్చినట్లు గుర్తించండి | ⚠️ |
| `prayers.markUnanswered` | Mark unanswered | జవాబు రాలేదని గుర్తించండి |  |
| `prayers.answered` | Answered | జవాబు వచ్చింది |  |
| `prayers.deleteLabel` | Delete this prayer | ఈ ప్రార్థనను తొలగించండి |  |
| `prayers.deleteConfirmTitle` | Delete this prayer? | ఈ ప్రార్థనను తొలగించాలా? |  |
| `prayers.deleteConfirmMessage` | This cannot be undone. | ఇది తిరిగి పొందలేరు. |  |

### Community

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `community.title` | Community | సమాజం |  |
| `community.empty` | No posts yet | ఇంకా పోస్ట్‌లు లేవు |  |
| `community.emptyMessage` | Community posts from the church will appear here. | చర్చి సమాజ పోస్ట్‌లు ఇక్కడ కనిపిస్తాయి. |  |
| `community.loadError` | Couldn’t load community posts. | సమాజ పోస్ట్‌లు లోడ్ కాలేదు. |  |
| `community.loadErrorShort` | Could not load posts. | పోస్ట్‌లు లోడ్ చేయలేకపోయాము. |  |
| `community.emptyShort` | No community posts yet. | ఇంకా సమాజ పోస్ట్‌లు లేవు. |  |

### Announcements

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `announcements.empty` | No announcements yet | ఇంకా ప్రకటనలు లేవు |  |
| `announcements.emptyMessage` | Church announcements will appear here. | చర్చి ప్రకటనలు ఇక్కడ కనిపిస్తాయి. |  |
| `announcements.loadError` | Couldn’t load announcements. | ప్రకటనలు లోడ్ కాలేదు. |  |
| `announcements.loadErrorShort` | Could not load announcements. | ప్రకటనలు లోడ్ చేయలేకపోయాము. |  |
| `announcements.emptyShort` | No announcements yet. | ఇంకా ప్రకటనలు లేవు. |  |

### Daily verse

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `dailyVerse.title` | Daily Verse | నేటి వచనం |  |
| `dailyVerse.today` | Today | నేడు |  |
| `dailyVerse.archive` | Previous verses | గత వచనాలు |  |
| `dailyVerse.empty` | No verse yet | ఇంకా వచనం లేదు |  |
| `dailyVerse.emptyMessage` | Today’s verse will appear here once it is published. | నేటి వచనం ప్రచురించిన తర్వాత ఇక్కడ కనిపిస్తుంది. |  |
| `dailyVerse.noneToday` | No daily verse set for today | నేటికి వచనం ఇంకా ఇవ్వలేదు |  |
| `dailyVerse.noneTodayMessage` | When your church posts today's verse, it will appear here. | మీ చర్చి నేటి వచనాన్ని పోస్ట్ చేసినప్పుడు ఇక్కడ కనిపిస్తుంది. |  |
| `dailyVerse.noPast` | No past verses yet | ఇంకా గత వచనాలు లేవు |  |
| `dailyVerse.noPastMessage` | Verses will build up here day by day. | వచనాలు రోజురోజుకూ ఇక్కడ చేరుతాయి. |  |
| `dailyVerse.noneTodayShort` | No daily verse set for today. | నేటికి వచనం ఇంకా ఇవ్వలేదు. |  |

### Notifications

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `notifications.title` | Notifications | నోటిఫికేషన్‌లు |  |
| `notifications.empty` | You have no notifications yet. | మీకు ఇంకా నోటిఫికేషన్‌లు లేవు. |  |
| `notifications.readError` | Your notification history couldn’t be read on this device. | ఈ ఫోన్‌లో మీ నోటిఫికేషన్ చరిత్రను చదవలేకపోయాము. |  |

### Sign in / sign up

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `auth.signInTitle` | Sign in to Bethaniya Ministries | Bethaniya Ministriesలోకి సైన్ ఇన్ అవ్వండి |  |
| `auth.signUpTitle` | Create your Bethaniya Ministries account | మీ Bethaniya Ministries ఖాతాను సృష్టించండి |  |
| `auth.email` | Email | ఇమెయిల్ |  |
| `auth.emailPlaceholder` | you@example.com | you@example.com |  |
| `auth.password` | Password | పాస్‌వర్డ్ |  |
| `auth.passwordPlaceholder` | Password ({min}+ characters) | పాస్‌వర్డ్ ({min}+ అక్షరాలు) |  |
| `auth.namePlaceholder` | Your name | మీ పేరు |  |
| `auth.signIn` | Sign in | సైన్ ఇన్ | ⚠️ |
| `auth.createAccount` | Create account | ఖాతా సృష్టించండి |  |
| `auth.sendResetLink` | Send reset link | రీసెట్ లింక్ పంపండి |  |
| `auth.forgotPassword` | Forgot your password? | పాస్‌వర్డ్ మర్చిపోయారా? |  |
| `auth.newHere` | New here? Create an account | కొత్తవారా? ఖాతా సృష్టించండి |  |
| `auth.backToSignIn` | Back to sign in | సైన్ ఇన్‌కు తిరిగి |  |
| `auth.resetTitle` | Reset your password | మీ పాస్‌వర్డ్ రీసెట్ చేయండి |  |
| `auth.resetSent` | If an account exists for that email, a password reset link is on its way. | ఆ ఇమెయిల్‌కు ఖాతా ఉంటే, పాస్‌వర్డ్ రీసెట్ లింక్ పంపబడుతుంది. |  |
| `auth.continueWithGoogle` | Continue with Google | Googleతో కొనసాగించండి |  |
| `auth.continueWithApple` | Continue with Apple | Appleతో కొనసాగించండి |  |

### Profile

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `profile.title` | Profile | ప్రొఫైల్ | ⚠️ |
| `profile.displayName` | Name | పేరు |  |
| `profile.emailLabel` | Email | ఇమెయిల్ |  |
| `profile.edit` | Edit | మార్చండి |  |
| `profile.notSet` | Not set | ఇవ్వలేదు |  |
| `profile.emailVerified` | Verified | ధృవీకరించబడింది |  |
| `profile.emailUnverified` | Not verified | ధృవీకరించలేదు |  |
| `profile.changePhoto` | Change photo | ఫోటో మార్చండి |  |
| `profile.saveFailed` | Couldn’t save your changes. Please try again. | మీ మార్పులు సేవ్ కాలేదు. మళ్లీ ప్రయత్నించండి. |  |
| `profile.resendVerification` | Resend verification email | ధృవీకరణ ఇమెయిల్ మళ్లీ పంపండి |  |
| `profile.loadError` | Could not load your profile. | మీ ప్రొఫైల్ లోడ్ చేయలేకపోయాము. |  |
| `profile.phoneNumber` | Phone Number | ఫోన్ నంబర్ |  |

### Settings

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `settings.title` | Settings | సెట్టింగ్‌లు | ⚠️ |
| `settings.language` | Language | భాష |  |
| `settings.languageEnglish` | English | ఇంగ్లీష్ |  |
| `settings.languageTelugu` | Telugu | తెలుగు |  |
| `settings.switchTo` | Switch | మార్చండి | ⚠️ |
| `settings.theme` | Theme | థీమ్ |  |
| `settings.themeDark` | Dark | డార్క్ |  |
| `settings.themeLight` | Light | లైట్ |  |
| `settings.notifications` | Notifications | నోటిఫికేషన్‌లు |  |
| `settings.about` | About | గురించి |  |
| `settings.privacyPolicy` | Privacy policy | గోప్యతా విధానం |  |
| `settings.terms` | Terms of service | సేవా నిబంధనలు |  |
| `settings.logOut` | Log Out | లాగ్ అవుట్ |  |
| `settings.account` | Account | ఖాతా |  |
| `settings.contactChurch` | Contact the church | చర్చిని సంప్రదించండి |  |
| `settings.notSetYet` | Not set yet | ఇంకా ఇవ్వలేదు |  |
| `settings.bibleTranslations` | Bible translations | బైబిల్ అనువాదాలు |  |
| `settings.view` | View | చూడండి |  |

---

Generated from `mobile/src/i18n/strings.ts`. Regenerate after editing:

```
node scripts/gen-telugu-review.mjs
```
