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

401 keys, grouped by screen area.

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
| `common.liveNow` | LIVE NOW | ప్రత్యక్ష ప్రసారం |  |
| `common.member` | Member | సభ్యుడు |  |
| `common.close` | Close | మూసివేయండి |  |
| `common.done` | Done | పూర్తయింది |  |

### Home

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `home.welcome` | Welcome | స్వాగతం |  |
| `home.verseOfTheDay` | Verse of the day | నేటి వచనం |  |
| `home.announcements` | Announcements | ప్రకటనలు |  |
| `home.watchLive` | Watch live | ప్రత్యక్షంగా చూడండి |  |
| `home.yourReadingPlan` | Your reading plan | మీ పఠన ప్రణాళిక |  |
| `home.upcomingEvents` | Upcoming events | రాబోయే కార్యక్రమాలు |  |
| `home.continueGrowing` | Continue growing | ఎదుగుతూ ఉండండి |  |
| `home.notificationsLabel` | Open notifications | నోటిఫికేషన్‌లను తెరవండి |  |
| `home.notificationsHint` | Shows the notifications you have received | మీకు వచ్చిన నోటిఫికేషన్‌లను చూపుతుంది |  |
| `home.dayOf` | Day {current} of {total} | {total}లో {current}వ రోజు |  |
| `home.profileLabel` | Open your profile | మీ ప్రొఫైల్ తెరవండి |  |
| `home.profileHint` | Shows your account details | మీ ఖాతా వివరాలను చూపుతుంది |  |
| `home.announcementsLabel` | Open announcements | ప్రకటనలు తెరవండి |  |
| `home.announcementsHint` | Shows announcements from the church | చర్చి ప్రకటనలను చూపుతుంది |  |
| `home.readingPlan` | Reading Plan | పఠన ప్రణాళిక |  |
| `home.startAPlan` | Start a Reading Plan | పఠన ప్రణాళిక ప్రారంభించండి |  |
| `home.percentComplete` | {percent}% | {percent}% |  |

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
| `bible.notInTranslation` | This chapter is not in this translation. | ఈ అధ్యాయం ఈ అనువాదంలో లేదు. |  |
| `bible.notInTranslationHelp` | Switch the Bible language in Settings to read this chapter in the other translation. | ఈ అధ్యాయాన్ని మరో అనువాదంలో చదవడానికి సెట్టింగ్‌లలో బైబిల్ భాషను మార్చండి. |  |
| `bible.numberingDiffers` | Verse numbering differs between these translations in this chapter, so the two are shown separately. | ఈ అధ్యాయంలో వచన సంఖ్యలు ఈ అనువాదాల మధ్య వేరుగా ఉన్నాయి, అందుకే రెండూ వేరువేరుగా చూపబడ్డాయి. |  |
| `bible.previous` | Previous | మునుపటి |  |
| `bible.next` | Next | తదుపరి |  |
| `bible.chapterLoadError` | Could not load this chapter. | ఈ అధ్యాయం లోడ్ చేయలేకపోయాము. |  |
| `bible.chapterNotFound` | Chapter not found. | అధ్యాయం కనబడలేదు. |  |
| `bible.modeTelugu` | Telugu | తెలుగు |  |
| `bible.modeEnglish` | English | ఇంగ్లీష్ |  |
| `bible.modeBilingual` | English + Telugu | ఇంగ్లీష్ + తెలుగు |  |
| `bible.bookNotFound` | Book not found. | పుస్తకం కనబడలేదు. |  |
| `bible.continueReading` | Continue reading | చదవడం కొనసాగించండి |  |
| `bible.toggleControls` | Scripture. Tap to show or hide the reading controls. | వాక్యభాగం. నియంత్రణలు చూపించడానికి లేదా దాచడానికి తట్టండి. |  |
| `bible.readingSettings` | Reading settings | చదివే అమరికలు |  |
| `bible.chapterSelector` | Choose a chapter | అధ్యాయం ఎంచుకోండి |  |
| `bible.selectBook` | Book | గ్రంథం |  |
| `bible.selectChapter` | Chapter | అధ్యాయం |  |
| `bible.verseActions` | Verse actions | వచనంపై చర్యలు |  |
| `bible.highlight` | Highlight | హైలైట్ చేయండి |  |
| `bible.removeHighlight` | Remove highlight | హైలైట్ తీసివేయండి |  |
| `bible.bookmark` | Bookmark | బుక్‌మార్క్ చేయండి |  |
| `bible.removeBookmark` | Remove bookmark | బుక్‌మార్క్ తీసివేయండి |  |
| `bible.addNote` | Add note | నోట్ జోడించండి |  |
| `bible.editNote` | Edit note | నోట్ సవరించండి |  |
| `bible.deleteNote` | Delete note | నోట్ తొలగించండి |  |
| `bible.notePlaceholder` | Your note on this verse | ఈ వచనంపై మీ నోట్ |  |
| `bible.share` | Share | పంచుకోండి |  |
| `bible.copy` | Copy | కాపీ చేయండి |  |
| `bible.copied` | Copied to the clipboard. | క్లిప్‌బోర్డ్‌కు కాపీ అయింది. |  |
| `bible.copyFailed` | Could not copy this verse. | ఈ వచనాన్ని కాపీ చేయలేకపోయాము. |  |
| `bible.shareFailed` | Could not share this verse. | ఈ వచనాన్ని పంచుకోలేకపోయాము. |  |
| `bible.saveFailed` | Could not save your change. | మీ మార్పును సేవ్ చేయలేకపోయాము. |  |
| `bible.highlightYellow` | Yellow | పసుపు |  |
| `bible.highlightGreen` | Green | ఆకుపచ్చ |  |
| `bible.highlightBlue` | Blue | నీలం |  |
| `bible.highlightPink` | Pink | గులాబీ |  |
| `bible.highlighted` | Highlighted | హైలైట్ చేయబడింది |  |
| `bible.bookmarked` | Bookmarked | బుక్‌మార్క్ చేయబడింది |  |
| `bible.hasNote` | Has a note | నోట్ ఉంది |  |
| `bible.signInToSave` | Sign in to save highlights, bookmarks and notes. | హైలైట్‌లు, బుక్‌మార్క్‌లు, నోట్‌లు సేవ్ చేయడానికి సైన్ ఇన్ అవ్వండి. |  |
| `bible.fontLabel` | Typeface | అక్షర శైలి |  |
| `bible.fontSerif` | Serif | సెరిఫ్ |  |
| `bible.fontSans` | Sans | సాన్స్ |  |
| `bible.sizeLabel` | Text size | అక్షర పరిమాణం |  |
| `bible.decreaseSize` | Smaller text | చిన్న అక్షరాలు |  |
| `bible.increaseSize` | Larger text | పెద్ద అక్షరాలు |  |
| `bible.lineHeightLabel` | Line spacing | పంక్తుల అంతరం |  |
| `bible.lineHeightCompact` | Compact | తక్కువ |  |
| `bible.lineHeightNormal` | Comfortable | మధ్యస్థం |  |
| `bible.lineHeightRelaxed` | Spacious | ఎక్కువ |  |
| `bible.widthLabel` | Column width | వరుస వెడల్పు |  |
| `bible.widthNarrow` | Narrower | సన్నం |  |
| `bible.widthNormal` | Default | సాధారణం |  |
| `bible.widthWide` | Wider | వెడల్పు |  |
| `bible.layoutLabel` | Bilingual layout | ద్విభాషా అమరిక |  |
| `bible.layoutStacked` | Stacked | ఒకదానిపై ఒకటి |  |
| `bible.layoutSideBySide` | Side by side | ప్రక్కప్రక్కన |  |

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
| `songs.favoriteAction` | Favourite | ఇష్టమైనది |  |
| `songs.favoritedState` | Favourited | ఇష్టమైనవిలో ఉంది |  |

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
| `events.dateTBA` | Date and time to be announced | తేదీ, సమయం తరువాత ప్రకటిస్తాము |  |
| `events.unsupportedStreamLink` | This stream link isn’t a supported YouTube URL, so it can’t be played here. | ఈ ప్రసార లింక్ మద్దతు ఉన్న YouTube URL కాదు, అందుకే ఇక్కడ ప్లే చేయలేము. |  |

### More

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `more.title` | More | మరిన్ని |  |
| `more.grow` | Grow | ఎదుగుదల |  |
| `more.general` | General | సాధారణం |  |
| `more.viewProfile` | View profile | ప్రొఫైల్ చూడండి |  |
| `more.readingPlans` | Reading Plans | పఠన ప్రణాళికలు |  |
| `more.prayers` | Prayers | ప్రార్థనలు |  |
| `more.myPrayerJournal` | My prayer journal | నా ప్రార్థన పుస్తకం |  |
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
| `community.introMessage` | Everything the church family shares, in one place. | సంఘ కుటుంబం పంచుకునేదంతా ఒకే చోట. |  |
| `community.postsSection` | From the church | సంఘం నుండి |  |
| `community.goToChat` | Church chat | సంఘ సంభాషణ |  |
| `community.goToChatHint` | Talk with the whole church | సంఘం మొత్తంతో మాట్లాడండి |  |
| `community.goToMedia` | Photos and videos | ఫోటోలు, వీడియోలు |  |
| `community.goToMediaHint` | Pictures and clips from church life | సంఘ జీవితంలోని చిత్రాలు, క్లిప్‌లు |  |

### Announcements

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `announcements.empty` | No announcements yet | ఇంకా ప్రకటనలు లేవు |  |
| `announcements.emptyMessage` | Church announcements will appear here. | చర్చి ప్రకటనలు ఇక్కడ కనిపిస్తాయి. |  |
| `announcements.loadError` | Couldn’t load announcements. | ప్రకటనలు లోడ్ కాలేదు. |  |
| `announcements.loadErrorShort` | Could not load announcements. | ప్రకటనలు లోడ్ చేయలేకపోయాము. |  |
| `announcements.emptyShort` | No announcements yet. | ఇంకా ప్రకటనలు లేవు. |  |
| `announcements.title` | Announcements | ప్రకటనలు |  |

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
| `dailyVerse.loadError` | Could not load today’s verse. | నేటి వచనం లోడ్ చేయలేకపోయాము. |  |
| `dailyVerse.imageLabel` | Illustration for today's verse | నేటి వచనానికి చిత్రం |  |
| `dailyVerse.unavailable` | Today's verse could not be loaded. | నేటి వచనం లోడ్ కాలేదు. |  |
| `dailyVerse.loading` | Loading today's verse | నేటి వచనం లోడ్ అవుతోంది |  |

### Notifications

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `notifications.title` | Notifications | నోటిఫికేషన్‌లు |  |
| `notifications.empty` | You have no notifications yet. | మీకు ఇంకా నోటిఫికేషన్‌లు లేవు. |  |
| `notifications.readError` | Your notification history couldn’t be read on this device. | ఈ ఫోన్‌లో మీ నోటిఫికేషన్ చరిత్రను చదవలేకపోయాము. |  |

### Sign in / sign up

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `auth.signInTitle` | Sign in to {app} | {app}లోకి సైన్ ఇన్ అవ్వండి |  |
| `auth.signUpTitle` | Create your {app} account | మీ {app} ఖాతాను సృష్టించండి |  |
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
| `profile.saved` | Saved. | సేవ్ అయింది. |  |
| `profile.nameEmpty` | Your name cannot be empty. | మీ పేరు ఖాళీగా ఉండకూడదు. |  |
| `profile.nameSaveFailed` | Could not save your name. Please try again. | మీ పేరు సేవ్ కాలేదు. మళ్లీ ప్రయత్నించండి. |  |
| `profile.photoPermissionRequired` | Photo library access is required to change your profile photo. | ప్రొఫైల్ ఫోటో మార్చడానికి ఫోటో లైబ్రరీ అనుమతి కావాలి. |  |
| `profile.photoMustBeImage` | Please choose an image file. | దయచేసి ఒక చిత్ర ఫైల్‌ను ఎంచుకోండి. |  |
| `profile.photoTooLarge` | Please choose an image smaller than 5MB. | దయచేసి 5MB కంటే చిన్న చిత్రాన్ని ఎంచుకోండి. |  |
| `profile.verificationSent` | Verification email sent. Check your inbox. | ధృవీకరణ ఇమెయిల్ పంపాము. మీ ఇన్‌బాక్స్ చూడండి. |  |

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
| `settings.appLanguage` | App language | యాప్ భాష |  |
| `settings.appLanguageHelp` | Changes the app’s buttons, menus and messages. Does not change the Bible. | యాప్‌లోని బటన్‌లు, మెనూలు, సందేశాలను మారుస్తుంది. బైబిల్‌ను మార్చదు. |  |
| `settings.bibleLanguage` | Bible language | బైబిల్ భాష |  |
| `settings.bibleLanguageHelp` | Changes the Bible text, book names and search. Does not change the app’s language. | బైబిల్ వచనం, పుస్తకాల పేర్లు, వెతుకుడును మారుస్తుంది. యాప్ భాషను మార్చదు. |  |
| `settings.themeSystem` | System | సిస్టమ్ |  |
| `settings.syncFailed` | Saved on this device. We could not sync it to your account just now. | ఈ పరికరంలో సేవ్ అయింది. ప్రస్తుతం దాన్ని మీ ఖాతాకు సింక్ చేయలేకపోయాం. |  |

### prophetVerse

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `prophetVerse.title` | Prophet Verse of the Day | ఈ రోజు ప్రవక్త వచనం |  |
| `prophetVerse.imageLabel` | Illustration for this prophet verse | ఈ ప్రవక్త వచనానికి చిత్రం |  |
| `prophetVerse.empty` | No prophet verse today | ఈ రోజు ప్రవక్త వచనం లేదు |  |
| `prophetVerse.emptyMessage` | When the church shares one, it will appear here beneath the Verse of the Day. | సంఘం పంచుకున్నప్పుడు, అది ఈ రోజు వచనం క్రింద ఇక్కడ కనిపిస్తుంది. |  |

### suspended

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `suspended.title` | Your account is suspended | మీ ఖాతా నిలిపివేయబడింది |  |
| `suspended.permanentMessage` | A church administrator has suspended this account. You can use the app again once an administrator restores access. | ఒక సంఘ నిర్వాహకుడు ఈ ఖాతాను నిలిపివేశారు. నిర్వాహకుడు తిరిగి అనుమతించిన తర్వాత మీరు యాప్‌ను మళ్లీ ఉపయోగించవచ్చు. |  |
| `suspended.temporaryMessage` | A church administrator has suspended this account for a while. It will unlock by itself when the time is up. | ఒక సంఘ నిర్వాహకుడు ఈ ఖాతాను కొంత కాలం పాటు నిలిపివేశారు. సమయం ముగిసిన వెంటనే ఇది దానంతట అదే తెరుచుకుంటుంది. |  |
| `suspended.until` | Until {when} | {when} వరకు |  |
| `suspended.canStillRead` | Nothing has been deleted, and you are still signed in. | ఏదీ తొలగించబడలేదు, మీరు ఇంకా సైన్ ఇన్‌లోనే ఉన్నారు. |  |
| `suspended.contactChurch` | If you think this is a mistake, please speak to someone at your church. | ఇది పొరపాటు అని మీరు భావిస్తే, దయచేసి మీ సంఘంలో ఎవరితోనైనా మాట్లాడండి. |  |
| `suspended.signOut` | Sign out | సైన్ అవుట్ |  |

### onboarding

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `onboarding.title` | Welcome to {app} | {app}కు స్వాగతం |  |
| `onboarding.subtitle` | A few details, so the church knows who you are. You can change any of these later in your profile. | మీరు ఎవరో చర్చికి తెలియడం కోసం కొన్ని వివరాలు. వీటిని తర్వాత మీ ప్రొఫైల్‌లో మార్చుకోవచ్చు. |  |
| `onboarding.fullName` | Full name | పూర్తి పేరు |  |
| `onboarding.fullNamePlaceholder` | Your name | మీ పేరు |  |
| `onboarding.fullNameError` | Please enter your name. | దయచేసి మీ పేరు నమోదు చేయండి. |  |
| `onboarding.phone` | Phone number | ఫోన్ నంబర్ |  |
| `onboarding.phonePlaceholder` | 98765 43210 | 98765 43210 |  |
| `onboarding.phoneHelp` | So the church can reach you. We will not send you a code, and this is not used to sign in. | చర్చి మిమ్మల్ని సంప్రదించడానికి. మేము ఏ కోడ్ పంపం, ఇది సైన్ ఇన్ కోసం కాదు. |  |
| `onboarding.phoneError` | Please enter a valid phone number. | దయచేసి సరైన ఫోన్ నంబర్ నమోదు చేయండి. |  |
| `onboarding.gender` | Gender | లింగం |  |
| `onboarding.genderMale` | Male | పురుషుడు |  |
| `onboarding.genderFemale` | Female | స్త్రీ |  |
| `onboarding.genderError` | Please choose one. | దయచేసి ఒకటి ఎంపిక చేయండి. |  |
| `onboarding.language` | Preferred language | ఇష్టమైన భాష |  |
| `onboarding.languageHelp` | Sets the language of the app. You can choose your Bible language separately in Settings. | యాప్ భాషను సెట్ చేస్తుంది. బైబిల్ భాషను సెట్టింగ్స్‌లో వేరేగా ఎంచుకోవచ్చు. |  |
| `onboarding.submit` | Continue | కొనసాగండి |  |
| `onboarding.skip` | Not now | ఇప్పుడు వద్దు |  |
| `onboarding.saveFailed` | We could not save your details. Please try again. | మీ వివరాలను సేవ్ చేయలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి. |  |
| `onboarding.completePrompt` | Finish setting up your profile | మీ ప్రొఫైల్ సెటప్ పూర్తి చేయండి |  |
| `onboarding.completeAction` | Complete | పూర్తి చేయండి |  |

### media

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `media.title` | Media | మీడియా |  |
| `media.sectionTitle` | Latest media | తాజా మీడియా |  |
| `media.empty` | Nothing here yet | ఇక్కడ ఇంకా ఏమీ లేదు |  |
| `media.emptyMessage` | The church has not posted any media yet. | చర్చి ఇంకా ఏ మీడియాను పోస్ట్ చేయలేదు. |  |
| `media.loadError` | Media could not be loaded. | మీడియాను లోడ్ చేయలేకపోయాం. |  |
| `media.loadingMore` | Loading more | మరిన్ని లోడ్ చేస్తోంది |  |
| `media.like` | Like | ఇష్టం |  |
| `media.unlike` | Remove like | ఇష్టం తీసివేయండి |  |
| `media.liked` | Liked | ఇష్టపడ్డారు |  |
| `media.comment` | Comment | వ్యాఖ్య |  |
| `media.comments` | Comments | వ్యాఖ్యలు |  |
| `media.share` | Share | షేర్ చేయండి |  |
| `media.save` | Save | సేవ్ చేయండి |  |
| `media.unsave` | Remove from saved | సేవ్ నుండి తీసివేయండి |  |
| `media.saved` | Saved | సేవ్ చేసారు |  |
| `media.savedTitle` | Saved media | సేవ్ చేసిన మీడియా |  |
| `media.savedEmpty` | Nothing saved yet | ఏమీ సేవ్ చేయలేదు |  |
| `media.savedEmptyMessage` | Media you save will appear here. | మీరు సేవ్ చేసిన మీడియా ఇక్కడ కనిపిస్తుంది. |  |
| `media.signInRequired` | Sign in to like, save and comment. You can keep browsing and sharing without an account. | ఇష్టం, సేవ్, వ్యాఖ్య కోసం సైన్ ఇన్ చేయండి. ఖాతా లేకుండానే చూడవచ్చు, షేర్ చేయవచ్చు. |  |
| `media.commentPlaceholder` | Write a comment | వ్యాఖ్య రాయండి |  |
| `media.postComment` | Post | పోస్ట్ |  |
| `media.commentFailed` | Your comment could not be posted. | మీ వ్యాఖ్యను పోస్ట్ చేయలేకపోయాం. |  |
| `media.noComments` | No comments yet. | ఇంకా వ్యాఖ్యలు లేవు. |  |
| `media.deleteComment` | Delete comment | వ్యాఖ్యను తొలగించండి |  |
| `media.playVideo` | Play video | వీడియో ప్లే చేయండి |  |
| `media.imageLabel` | Media image | మీడియా చిత్రం |  |
| `media.openPost` | Open post | పోస్ట్ తెరవండి |  |
| `media.actionFailed` | That did not work. Please try again. | అది పని చేయలేదు. దయచేసి మళ్లీ ప్రయత్నించండి. |  |
| `media.publishedOn` | Posted {date} | {date}న పోస్ట్ చేయబడింది |  |
| `media.refresh` | Refresh | రిఫ్రెష్ చేయండి |  |

### chat

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `chat.title` | Church chat | సంఘ సంభాషణ |  |
| `chat.sectionTitle` | Church chat | సంఘ సంభాషణ |  |
| `chat.placeholder` | Write a message | సందేశం రాయండి |  |
| `chat.send` | Send | పంపండి |  |
| `chat.empty` | No messages yet | ఇంకా సందేశాలు లేవు |  |
| `chat.emptyMessage` | Say hello to the church family. | సంఘ కుటుంబానికి పలకరింపు చెప్పండి. |  |
| `chat.loadError` | Chat could not be loaded | సంభాషణను లోడ్ చేయలేకపోయాం |  |
| `chat.loadErrorMessage` | Check your connection and try again. | మీ కనెక్షన్‌ను చూసి మళ్లీ ప్రయత్నించండి. |  |
| `chat.loadOlder` | Load earlier messages | పాత సందేశాలను చూడండి |  |
| `chat.loadingOlder` | Loading earlier messages… | పాత సందేశాలు లోడ్ అవుతున్నాయి… |  |
| `chat.sendFailed` | Your message was not sent. | మీ సందేశం పంపబడలేదు. |  |
| `chat.removed` | This message was removed. | ఈ సందేశం తొలగించబడింది. |  |
| `chat.deleteLabel` | Delete your message | మీ సందేశాన్ని తొలగించండి |  |
| `chat.deleteConfirmTitle` | Delete this message? | ఈ సందేశాన్ని తొలగించాలా? |  |
| `chat.deleteConfirmMessage` | It will be removed for everyone. This cannot be undone. | ఇది అందరి నుండి తొలగించబడుతుంది. దీనిని తిరిగి పొందలేరు. |  |
| `chat.you` | You | మీరు |  |
| `chat.sending` | Sending… | పంపుతోంది… |  |
| `chat.messageLabel` | {name} said: {text} | {name} చెప్పారు: {text} |  |

### prayerWall

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `prayerWall.title` | Prayer requests | ప్రార్థన విన్నపాలు |  |
| `prayerWall.sectionTitle` | Prayer requests | ప్రార్థన విన్నపాలు |  |
| `prayerWall.newRequest` | Ask for prayer | ప్రార్థన కోరండి |  |
| `prayerWall.editRequest` | Edit your request | మీ విన్నపాన్ని సవరించండి |  |
| `prayerWall.titleLabel` | Subject | విషయం |  |
| `prayerWall.titlePlaceholder` | What would you like prayer for? | దేని కోసం ప్రార్థన కావాలి? |  |
| `prayerWall.bodyLabel` | Details | వివరాలు |  |
| `prayerWall.bodyPlaceholder` | Tell the church as much as you would like to share. | మీరు పంచుకోదలచినంత సంఘానికి తెలియజేయండి. |  |
| `prayerWall.categoryLabel` | Category | విభాగం |  |
| `prayerWall.categoryNone` | No category | విభాగం లేదు |  |
| `prayerWall.category.healing` | Healing | స్వస్థత |  |
| `prayerWall.category.family` | Family | కుటుంబం |  |
| `prayerWall.category.guidance` | Guidance | నడిపింపు |  |
| `prayerWall.category.thanksgiving` | Thanksgiving | కృతజ్ఞతాస్తుతులు |  |
| `prayerWall.category.provision` | Provision | అవసరాలు |  |
| `prayerWall.category.other` | Other | ఇతరం |  |
| `prayerWall.anonymousLabel` | Anonymous | పేరు లేకుండా |  |
| `prayerWall.anonymousToggle` | Post anonymously | పేరు లేకుండా పంచుకోండి |  |
| `prayerWall.anonymousHelp` | Your name is not saved with this request and nobody in the church can see who wrote it. | ఈ విన్నపంతో మీ పేరు భద్రపరచబడదు, ఎవరు రాశారో సంఘంలో ఎవరికీ తెలియదు. |  |
| `prayerWall.anonymousLocked` | Whether this request shows your name cannot be changed. | ఈ విన్నపంలో మీ పేరు కనిపించడాన్ని ఇక మార్చలేరు. |  |
| `prayerWall.submit` | Share request | విన్నపాన్ని పంచుకోండి |  |
| `prayerWall.submitFailed` | Your request could not be shared. | మీ విన్నపాన్ని పంచుకోలేకపోయాం. |  |
| `prayerWall.titleRequired` | Please write a subject. | దయచేసి ఒక విషయం రాయండి. |  |
| `prayerWall.bodyRequired` | Please write a little more. | దయచేసి కొంచెం ఎక్కువ రాయండి. |  |
| `prayerWall.empty` | No requests yet | ఇంకా విన్నపాలు లేవు |  |
| `prayerWall.emptyMessage` | Be the first to ask the church to pray with you. | సంఘం మీతో కలిసి ప్రార్థించేలా మొదటివారు మీరే అవ్వండి. |  |
| `prayerWall.loadError` | Requests could not be loaded | విన్నపాలను లోడ్ చేయలేకపోయాం |  |
| `prayerWall.loadErrorMessage` | Check your connection and try again. | మీ కనెక్షన్‌ను చూసి మళ్లీ ప్రయత్నించండి. |  |
| `prayerWall.loadingMore` | Loading more… | మరిన్ని లోడ్ అవుతున్నాయి… |  |
| `prayerWall.refresh` | Refresh | రిఫ్రెష్ చేయండి |  |
| `prayerWall.status.open` | Praying | ప్రార్థిస్తున్నాం |  |
| `prayerWall.status.answered` | Answered | జవాబు దొరికింది |  |
| `prayerWall.status.closed` | Closed | ముగిసింది |  |
| `prayerWall.markAnswered` | Mark answered | జవాబు దొరికిందని గుర్తించండి |  |
| `prayerWall.reopen` | Still praying | ఇంకా ప్రార్థిస్తున్నాం |  |
| `prayerWall.edit` | Edit | సవరించండి |  |
| `prayerWall.yours` | Your request | మీ విన్నపం |  |
| `prayerWall.deleteConfirmTitle` | Delete this request? | ఈ విన్నపాన్ని తొలగించాలా? |  |
| `prayerWall.deleteConfirmMessage` | It will be removed for everyone. This cannot be undone. | ఇది అందరి నుండి తొలగించబడుతుంది. దీనిని తిరిగి పొందలేరు. |  |
| `prayerWall.removed` | This request was removed. | ఈ విన్నపం తొలగించబడింది. |  |
| `prayerWall.signInRequired` | Sign in to share a prayer request. | ప్రార్థన విన్నపం పంచుకోవడానికి సైన్ ఇన్ చేయండి. |  |

### report

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `report.action` | Report | ఫిర్యాదు చేయండి |  |
| `report.title` | Report this | దీనిపై ఫిర్యాదు |  |
| `report.intro` | A church administrator will look at this. Your name is not shown to anyone else. | సంఘ నిర్వాహకులు దీనిని పరిశీలిస్తారు. మీ పేరు ఇతరులకు కనిపించదు. |  |
| `report.reasonLabel` | Why are you reporting it? | దేనికి ఫిర్యాదు చేస్తున్నారు? |  |
| `report.reason.spam` | Spam or advertising | స్పామ్ లేదా ప్రకటన |  |
| `report.reason.harassment` | Harassment or bullying | వేధింపు |  |
| `report.reason.hate` | Hateful language | ద్వేషపూరిత మాటలు |  |
| `report.reason.sexual` | Sexual content | లైంగిక విషయం |  |
| `report.reason.violence` | Violence or threats | హింస లేదా బెదిరింపు |  |
| `report.reason.misinformation` | False information | తప్పుడు సమాచారం |  |
| `report.reason.other` | Something else | మరేదైనా |  |
| `report.detailsLabel` | Anything else we should know? (optional) | ఇంకేమైనా చెప్పాలనుకుంటున్నారా? (ఐచ్ఛికం) |  |
| `report.detailsPlaceholder` | Add a little detail | కొంచెం వివరం రాయండి |  |
| `report.submit` | Send report | ఫిర్యాదు పంపండి |  |
| `report.submitted` | Thank you | ధన్యవాదాలు |  |
| `report.submittedMessage` | A church administrator will look at this. | సంఘ నిర్వాహకులు దీనిని పరిశీలిస్తారు. |  |
| `report.alreadyReported` | Reported | ఫిర్యాదు చేశారు |  |
| `report.failed` | Your report could not be sent. | మీ ఫిర్యాదు పంపబడలేదు. |  |

### account

| Key | English | Telugu | |
| --- | --- | --- | --- |
| `account.suspendedTitle` | Posting is paused | పోస్ట్ చేయడం నిలిపివేయబడింది |  |
| `account.suspendedMessage` | A church administrator has paused posting on your account. You can still read everything. Please speak to the church office. | సంఘ నిర్వాహకులు మీ ఖాతాలో పోస్ట్ చేయడాన్ని నిలిపివేశారు. మీరు అన్నీ చదవగలరు. దయచేసి సంఘ కార్యాలయంతో మాట్లాడండి. |  |

---

Generated from `mobile/src/i18n/strings.ts`. Regenerate after editing:

```
node scripts/gen-telugu-review.mjs
```
