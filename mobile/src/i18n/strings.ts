/**
 * The app's user-facing strings, in English and Telugu.
 *
 * WHY THIS EXISTS. Until the V1 tester-feedback pass the app had NO
 * localization layer at all -- no dependency, no catalogue, no lookup
 * function. `usePreferences().languagePreference` ('en' | 'te') existed,
 * but it only ever selected which BIBLE VERSE DATASET to read (see
 * ../features/bible/dataSource.ts). Every screen's own text was a
 * hardcoded English literal, so switching the app to Telugu changed the
 * scripture and nothing else -- which is exactly what the tester
 * reported.
 *
 * ONE LANGUAGE SOURCE, NOT TWO. This deliberately introduces no second
 * language state. `useTranslation()` reads the SAME
 * `usePreferences().languagePreference` the Bible already used, so the
 * Settings toggle drives the UI language and the Bible language together,
 * one persisted value, already synced to AsyncStorage and Firestore.
 * Because it is React context state, every consumer re-renders the moment
 * it changes -- no reload, no restart.
 *
 * NO DEPENDENCY. A plain keyed record and a lookup function. The app has
 * no i18n library and does not need one for two languages and a few
 * hundred strings: no plural rules, no gender, no date/number formatting
 * beyond what `toLocaleDateString` already does.
 *
 * WHAT IS *NOT* HERE. Internal identifiers are never localized and must
 * never be added to this file: Bible book ids ('genesis', '1-samuel'),
 * Firestore field and collection names, role values ('content_admin'),
 * testIDs, route names, log messages. Bible BOOK NAMES are localized but
 * live in ../features/bible/books.ts next to the canon metadata they
 * belong to, read via getBookName().
 *
 * TRANSLATION PROVENANCE. The Telugu strings below were drafted during
 * the V1 tester-feedback pass and are PENDING REVIEW by a Telugu-speaking
 * member of the church -- see /TELUGU_REVIEW.md, which is generated from
 * this file and lists every key with its English and Telugu side by side.
 * Anything wrong there is a wording fix in this one file.
 */
import type { BibleLanguage } from '../features/bible/types';

/**
 * Every key the app can translate. Adding a key here forces both
 * catalogues below to supply it -- that is the point of typing it this
 * way rather than as a loose record: a missing Telugu string is a
 * compile error, not a silent English fallback discovered on a device.
 */
export interface Strings {
  // --- Navigation (bottom tab bar) ---
  'nav.home': string;
  'nav.bible': string;
  'nav.songs': string;
  'nav.events': string;
  'nav.more': string;

  // --- Common actions and states ---
  'common.loading': string;
  'common.tryAgain': string;
  'common.save': string;
  'common.cancel': string;
  'common.delete': string;
  'common.seeAll': string;
  'common.back': string;
  'common.search': string;

  // --- Home ---
  'home.welcome': string;
  'home.verseOfTheDay': string;
  'home.announcements': string;
  'home.liveNow': string;
  'home.watchLive': string;
  'home.yourReadingPlan': string;
  'home.upcomingEvents': string;
  'home.continueGrowing': string;
  'home.notificationsLabel': string;
  'home.notificationsHint': string;
  'home.dayOf': string;

  // --- Bible ---
  'bible.title': string;
  'bible.oldTestament': string;
  'bible.newTestament': string;
  'bible.chapters': string;
  'bible.chapter': string;
  'bible.searchPlaceholder': string;
  'bible.searchPrompt': string;
  'bible.noResults': string;
  'bible.switchLanguage': string;
  'bible.notInTranslation': string;
  'bible.numberingDiffers': string;

  // --- Songs ---
  'songs.title': string;
  'songs.empty': string;
  'songs.emptyMessage': string;
  'songs.favorite': string;
  'songs.unfavorite': string;
  'songs.play': string;
  'songs.pause': string;
  'songs.restart': string;
  'songs.audioError': string;

  // --- Events ---
  'events.title': string;
  'events.empty': string;
  'events.emptyMessage': string;
  'events.live': string;
  'events.watchOnYouTube': string;
  'events.loadError': string;

  // --- More ---
  'more.title': string;
  'more.grow': string;
  'more.general': string;
  'more.viewProfile': string;
  'more.readingPlans': string;
  'more.prayers': string;
  'more.community': string;
  'more.notifications': string;
  'more.settings': string;

  // --- Plans ---
  'plans.title': string;
  'plans.empty': string;
  'plans.emptyMessage': string;
  'plans.start': string;
  'plans.continue': string;
  'plans.markComplete': string;
  'plans.completed': string;
  'plans.prayerPrompt': string;
  'plans.day': string;
  'plans.days': string;
  'plans.noReadings': string;
  'plans.noReadingsMessage': string;
  'plans.loadError': string;
  'plans.loadErrorMessage': string;
  'plans.dayNotFound': string;
  'plans.dayLoadError': string;

  // --- Prayers ---
  'prayers.title': string;
  'prayers.newRequest': string;
  'prayers.placeholder': string;
  'prayers.add': string;
  'prayers.empty': string;
  'prayers.emptyMessage': string;
  'prayers.loadError': string;
  'prayers.loadErrorMessage': string;
  'prayers.markAnswered': string;
  'prayers.markUnanswered': string;
  'prayers.answered': string;
  'prayers.deleteLabel': string;
  'prayers.deleteConfirmTitle': string;
  'prayers.deleteConfirmMessage': string;

  // --- Community ---
  'community.title': string;
  'community.empty': string;
  'community.emptyMessage': string;
  'community.loadError': string;

  // --- Announcements ---
  'announcements.empty': string;
  'announcements.emptyMessage': string;
  'announcements.loadError': string;

  // --- Daily verse ---
  'dailyVerse.title': string;
  'dailyVerse.today': string;
  'dailyVerse.archive': string;
  'dailyVerse.empty': string;
  'dailyVerse.emptyMessage': string;

  // --- Notifications ---
  'notifications.title': string;
  'notifications.empty': string;
  'notifications.readError': string;

  // --- Authentication ---
  'auth.signInTitle': string;
  'auth.signUpTitle': string;
  'auth.email': string;
  'auth.emailPlaceholder': string;
  'auth.password': string;
  'auth.passwordPlaceholder': string;
  'auth.namePlaceholder': string;
  'auth.signIn': string;
  'auth.createAccount': string;
  'auth.sendResetLink': string;
  'auth.forgotPassword': string;
  'auth.newHere': string;
  'auth.backToSignIn': string;
  'auth.resetTitle': string;
  'auth.resetSent': string;
  'auth.continueWithGoogle': string;
  'auth.continueWithApple': string;

  // --- Profile ---
  'profile.title': string;
  'profile.displayName': string;
  'profile.emailLabel': string;
  'profile.edit': string;
  'profile.notSet': string;
  'profile.emailVerified': string;
  'profile.emailUnverified': string;
  'profile.changePhoto': string;
  'profile.saveFailed': string;

  // --- Settings ---
  'settings.title': string;
  'settings.language': string;
  'settings.languageEnglish': string;
  'settings.languageTelugu': string;
  'settings.switchTo': string;
  'settings.theme': string;
  'settings.themeDark': string;
  'settings.themeLight': string;
  'settings.notifications': string;
  'settings.about': string;
  'settings.privacyPolicy': string;
  'settings.terms': string;
  'settings.logOut': string;
  'settings.account': string;
  'settings.contactChurch': string;
  'settings.notSetYet': string;
  'settings.bibleTranslations': string;
  'settings.view': string;

  // --- Added while wiring the remaining V1 screens ---
  'songs.loadError': string;
  'songs.emptyShort': string;
  'plans.loadErrorShort': string;
  'bible.previous': string;
  'bible.next': string;
  'dailyVerse.noneToday': string;
  'dailyVerse.noneTodayMessage': string;
  'dailyVerse.noPast': string;
  'dailyVerse.noPastMessage': string;
  'profile.resendVerification': string;
  'events.loadErrorShort': string;
  'community.loadErrorShort': string;
  'plans.emptyShort': string;
  'community.emptyShort': string;
  'profile.loadError': string;
  'profile.phoneNumber': string;
  'events.openInMaps': string;
  'events.emptyShort': string;
  'bible.chapterLoadError': string;
  'bible.chapterNotFound': string;
  'dailyVerse.noneTodayShort': string;
  'announcements.loadErrorShort': string;
  'announcements.emptyShort': string;
  'home.profileLabel': string;
  'home.profileHint': string;
  'home.announcementsLabel': string;
  'home.announcementsHint': string;
  'home.readingPlan': string;
  'home.startAPlan': string;
  'home.percentComplete': string;
  'announcements.title': string;
}

export type StringKey = keyof Strings;

const en: Strings = {
  'nav.home': 'Home',
  'nav.bible': 'Bible',
  'nav.songs': 'Songs',
  'nav.events': 'Events',
  'nav.more': 'More',

  'common.loading': 'Loading…',
  'common.tryAgain': 'Try again',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.seeAll': 'See all',
  'common.back': 'Back',
  'common.search': 'Search',

  'home.welcome': 'Welcome',
  'home.verseOfTheDay': 'Verse of the day',
  'home.announcements': 'Announcements',
  'home.liveNow': 'LIVE NOW',
  'home.watchLive': 'Watch live',
  'home.yourReadingPlan': 'Your reading plan',
  'home.upcomingEvents': 'Upcoming events',
  'home.continueGrowing': 'Continue growing',
  'home.notificationsLabel': 'Open notifications',
  'home.notificationsHint': 'Shows the notifications you have received',
  'home.dayOf': 'Day {current} of {total}',

  'bible.title': 'Bible',
  'bible.oldTestament': 'Old Testament',
  'bible.newTestament': 'New Testament',
  'bible.chapters': 'Chapters',
  'bible.chapter': 'Chapter',
  'bible.searchPlaceholder': 'Search the Bible',
  'bible.searchPrompt': 'Enter a search term to find a passage.',
  'bible.noResults': 'No results found for “{query}”.',
  'bible.switchLanguage': 'Switch language',
  'bible.notInTranslation': 'This chapter is not in this translation.',
  'bible.numberingDiffers':
    'Verse numbering differs between these translations in this chapter, so the two are shown separately.',

  'songs.title': 'Songs',
  'songs.empty': 'No songs yet',
  'songs.emptyMessage': 'Songs added by the church will appear here.',
  'songs.favorite': 'Add to favourites',
  'songs.unfavorite': 'Remove from favourites',
  'songs.play': 'Play',
  'songs.pause': 'Pause',
  'songs.restart': 'Restart',
  'songs.audioError': 'Could not load this song’s audio.',

  'events.title': 'Events',
  'events.empty': 'No events yet',
  'events.emptyMessage': 'Upcoming services and events will appear here.',
  'events.live': 'LIVE',
  'events.watchOnYouTube': 'Watch live on YouTube',
  'events.loadError': 'Couldn’t load events. Check your connection and try again.',

  'more.title': 'More',
  'more.grow': 'Grow',
  'more.general': 'General',
  'more.viewProfile': 'View profile',
  'more.readingPlans': 'Reading Plans',
  'more.prayers': 'Prayers',
  'more.community': 'Community',
  'more.notifications': 'Notifications',
  'more.settings': 'Settings',

  'plans.title': 'Reading Plans',
  'plans.empty': 'No reading plans yet',
  'plans.emptyMessage': 'Reading plans added by the church will appear here.',
  'plans.start': 'Start Plan',
  'plans.continue': 'Continue',
  'plans.markComplete': 'Mark Complete',
  'plans.completed': 'Completed',
  'plans.prayerPrompt': 'Prayer Prompt',
  'plans.day': 'day',
  'plans.days': 'days',
  'plans.noReadings': 'No readings yet',
  'plans.noReadingsMessage': 'This plan hasn’t had its daily readings added.',
  'plans.loadError': 'Couldn’t load this plan',
  'plans.loadErrorMessage': 'Check your connection and open the plan again.',
  'plans.dayNotFound': 'This day could not be found.',
  'plans.dayLoadError':
    'This reading couldn’t be loaded. Check your connection and try again.',

  'prayers.title': 'Prayers',
  'prayers.newRequest': 'New Prayer Request',
  'prayers.placeholder': 'What’s on your heart?',
  'prayers.add': 'Add Prayer',
  'prayers.empty': 'No prayers yet',
  'prayers.emptyMessage': 'Add a prayer request above — only you can see it.',
  'prayers.loadError': 'Couldn’t load prayers',
  'prayers.loadErrorMessage': 'Check your connection and try again.',
  'prayers.markAnswered': 'Mark answered',
  'prayers.markUnanswered': 'Mark unanswered',
  'prayers.answered': 'Answered',
  'prayers.deleteLabel': 'Delete this prayer',
  'prayers.deleteConfirmTitle': 'Delete this prayer?',
  'prayers.deleteConfirmMessage': 'This cannot be undone.',

  'community.title': 'Community',
  'community.empty': 'No posts yet',
  'community.emptyMessage': 'Community posts from the church will appear here.',
  'community.loadError': 'Couldn’t load community posts.',

  'announcements.empty': 'No announcements yet',
  'announcements.emptyMessage': 'Church announcements will appear here.',
  'announcements.loadError': 'Couldn’t load announcements.',

  'dailyVerse.title': 'Daily Verse',
  'dailyVerse.today': 'Today',
  'dailyVerse.archive': 'Previous verses',
  'dailyVerse.empty': 'No verse yet',
  'dailyVerse.emptyMessage': 'Today’s verse will appear here once it is published.',

  'notifications.title': 'Notifications',
  'notifications.empty': 'You have no notifications yet.',
  'notifications.readError': 'Your notification history couldn’t be read on this device.',

  'auth.signInTitle': 'Sign in to {app}',
  'auth.signUpTitle': 'Create your {app} account',
  'auth.email': 'Email',
  'auth.emailPlaceholder': 'you@example.com',
  'auth.password': 'Password',
  'auth.passwordPlaceholder': 'Password ({min}+ characters)',
  'auth.namePlaceholder': 'Your name',
  'auth.signIn': 'Sign in',
  'auth.createAccount': 'Create account',
  'auth.sendResetLink': 'Send reset link',
  'auth.forgotPassword': 'Forgot your password?',
  'auth.newHere': 'New here? Create an account',
  'auth.backToSignIn': 'Back to sign in',
  'auth.resetTitle': 'Reset your password',
  'auth.resetSent':
    'If an account exists for that email, a password reset link is on its way.',
  'auth.continueWithGoogle': 'Continue with Google',
  'auth.continueWithApple': 'Continue with Apple',

  'profile.title': 'Profile',
  'profile.displayName': 'Name',
  'profile.emailLabel': 'Email',
  'profile.edit': 'Edit',
  'profile.notSet': 'Not set',
  'profile.emailVerified': 'Verified',
  'profile.emailUnverified': 'Not verified',
  'profile.changePhoto': 'Change photo',
  'profile.saveFailed': 'Couldn’t save your changes. Please try again.',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.languageEnglish': 'English',
  'settings.languageTelugu': 'Telugu',
  'settings.switchTo': 'Switch',
  'settings.theme': 'Theme',
  'settings.themeDark': 'Dark',
  'settings.themeLight': 'Light',
  'settings.notifications': 'Notifications',
  'settings.about': 'About',
  'settings.privacyPolicy': 'Privacy policy',
  'settings.terms': 'Terms of service',
  'settings.logOut': 'Log Out',
  'settings.account': 'Account',
  'settings.contactChurch': 'Contact the church',
  'settings.notSetYet': 'Not set yet',
  'settings.bibleTranslations': 'Bible translations',
  'settings.view': 'View',

  'songs.loadError': 'Could not load songs.',
  'songs.emptyShort': 'No songs yet.',
  'plans.loadErrorShort': 'Could not load reading plans.',
  'bible.previous': 'Previous',
  'bible.next': 'Next',
  'dailyVerse.noneToday': 'No daily verse set for today',
  'dailyVerse.noneTodayMessage':
    "When your church posts today's verse, it will appear here.",
  'dailyVerse.noPast': 'No past verses yet',
  'dailyVerse.noPastMessage': 'Verses will build up here day by day.',
  'profile.resendVerification': 'Resend verification email',
  'events.loadErrorShort': 'Could not load events.',
  'community.loadErrorShort': 'Could not load posts.',
  'plans.emptyShort': 'No reading plans yet.',
  'community.emptyShort': 'No community posts yet.',
  'profile.loadError': 'Could not load your profile.',
  'profile.phoneNumber': 'Phone Number',
  'events.openInMaps': 'Open in Maps',
  'events.emptyShort': 'No upcoming events.',
  'bible.chapterLoadError': 'Could not load this chapter.',
  'bible.chapterNotFound': 'Chapter not found.',
  'dailyVerse.noneTodayShort': 'No daily verse set for today.',
  'announcements.loadErrorShort': 'Could not load announcements.',
  'announcements.emptyShort': 'No announcements yet.',
  'home.profileLabel': 'Open your profile',
  'home.profileHint': 'Shows your account details',
  'home.announcementsLabel': 'Open announcements',
  'home.announcementsHint': 'Shows announcements from the church',
  'home.readingPlan': 'Reading Plan',
  'home.startAPlan': 'Start a Reading Plan',
  'home.percentComplete': '{percent}%',
  'announcements.title': 'Announcements',
};

/**
 * Telugu. DRAFTED, PENDING CHURCH REVIEW -- see this module's header and
 * /TELUGU_REVIEW.md. Church/product nouns that the congregation uses in
 * English (the church's own name) are deliberately left in English or
 * transliterated rather than translated.
 */
const te: Strings = {
  'nav.home': 'హోమ్',
  'nav.bible': 'బైబిల్',
  'nav.songs': 'పాటలు',
  'nav.events': 'కార్యక్రమాలు',
  'nav.more': 'మరిన్ని',

  'common.loading': 'లోడ్ అవుతోంది…',
  'common.tryAgain': 'మళ్లీ ప్రయత్నించండి',
  'common.save': 'సేవ్ చేయండి',
  'common.cancel': 'రద్దు',
  'common.delete': 'తొలగించండి',
  'common.seeAll': 'అన్నీ చూడండి',
  'common.back': 'వెనుకకు',
  'common.search': 'వెతకండి',

  'home.welcome': 'స్వాగతం',
  'home.verseOfTheDay': 'నేటి వచనం',
  'home.announcements': 'ప్రకటనలు',
  'home.liveNow': 'ప్రత్యక్ష ప్రసారం',
  'home.watchLive': 'ప్రత్యక్షంగా చూడండి',
  'home.yourReadingPlan': 'మీ పఠన ప్రణాళిక',
  'home.upcomingEvents': 'రాబోయే కార్యక్రమాలు',
  'home.continueGrowing': 'ఎదుగుతూ ఉండండి',
  'home.notificationsLabel': 'నోటిఫికేషన్‌లను తెరవండి',
  'home.notificationsHint': 'మీకు వచ్చిన నోటిఫికేషన్‌లను చూపుతుంది',
  'home.dayOf': '{total}లో {current}వ రోజు',

  'bible.title': 'బైబిల్',
  'bible.oldTestament': 'పాత నిబంధన',
  'bible.newTestament': 'క్రొత్త నిబంధన',
  'bible.chapters': 'అధ్యాయాలు',
  'bible.chapter': 'అధ్యాయం',
  'bible.searchPlaceholder': 'బైబిల్‌లో వెతకండి',
  'bible.searchPrompt': 'వాక్యభాగం కనుగొనడానికి పదం టైప్ చేయండి.',
  'bible.noResults': '“{query}” కోసం ఫలితాలు లేవు.',
  'bible.switchLanguage': 'భాష మార్చండి',
  'bible.notInTranslation': 'ఈ అధ్యాయం ఈ అనువాదంలో లేదు.',
  'bible.numberingDiffers':
    'ఈ అధ్యాయంలో వచన సంఖ్యలు ఈ అనువాదాల మధ్య వేరుగా ఉన్నాయి, అందుకే రెండూ వేరువేరుగా చూపబడ్డాయి.',

  'songs.title': 'పాటలు',
  'songs.empty': 'ఇంకా పాటలు లేవు',
  'songs.emptyMessage': 'చర్చి చేర్చిన పాటలు ఇక్కడ కనిపిస్తాయి.',
  'songs.favorite': 'ఇష్టమైనవిలో చేర్చండి',
  'songs.unfavorite': 'ఇష్టమైనవి నుండి తీసివేయండి',
  'songs.play': 'ప్లే',
  'songs.pause': 'ఆపండి',
  'songs.restart': 'మొదటి నుండి',
  'songs.audioError': 'ఈ పాట ఆడియో లోడ్ చేయలేకపోయాము.',

  'events.title': 'కార్యక్రమాలు',
  'events.empty': 'ఇంకా కార్యక్రమాలు లేవు',
  'events.emptyMessage': 'రాబోయే ఆరాధనలు, కార్యక్రమాలు ఇక్కడ కనిపిస్తాయి.',
  'events.live': 'ప్రత్యక్షం',
  'events.watchOnYouTube': 'YouTubeలో ప్రత్యక్షంగా చూడండి',
  'events.loadError': 'కార్యక్రమాలు లోడ్ కాలేదు. కనెక్షన్ చూసి మళ్లీ ప్రయత్నించండి.',

  'more.title': 'మరిన్ని',
  'more.grow': 'ఎదుగుదల',
  'more.general': 'సాధారణం',
  'more.viewProfile': 'ప్రొఫైల్ చూడండి',
  'more.readingPlans': 'పఠన ప్రణాళికలు',
  'more.prayers': 'ప్రార్థనలు',
  'more.community': 'సమాజం',
  'more.notifications': 'నోటిఫికేషన్‌లు',
  'more.settings': 'సెట్టింగ్‌లు',

  'plans.title': 'పఠన ప్రణాళికలు',
  'plans.empty': 'ఇంకా పఠన ప్రణాళికలు లేవు',
  'plans.emptyMessage': 'చర్చి చేర్చిన పఠన ప్రణాళికలు ఇక్కడ కనిపిస్తాయి.',
  'plans.start': 'ప్రణాళిక ప్రారంభించండి',
  'plans.continue': 'కొనసాగించండి',
  'plans.markComplete': 'పూర్తయినట్లు గుర్తించండి',
  'plans.completed': 'పూర్తయింది',
  'plans.prayerPrompt': 'ప్రార్థన సూచన',
  'plans.day': 'రోజు',
  'plans.days': 'రోజులు',
  'plans.noReadings': 'ఇంకా పఠనాలు లేవు',
  'plans.noReadingsMessage': 'ఈ ప్రణాళికకు రోజువారీ పఠనాలు ఇంకా చేర్చలేదు.',
  'plans.loadError': 'ఈ ప్రణాళిక లోడ్ కాలేదు',
  'plans.loadErrorMessage': 'కనెక్షన్ చూసి ప్రణాళికను మళ్లీ తెరవండి.',
  'plans.dayNotFound': 'ఈ రోజు కనబడలేదు.',
  'plans.dayLoadError': 'ఈ పఠనం లోడ్ కాలేదు. కనెక్షన్ చూసి మళ్లీ ప్రయత్నించండి.',

  'prayers.title': 'ప్రార్థనలు',
  'prayers.newRequest': 'కొత్త ప్రార్థన అభ్యర్థన',
  'prayers.placeholder': 'మీ హృదయంలో ఏముంది?',
  'prayers.add': 'ప్రార్థన చేర్చండి',
  'prayers.empty': 'ఇంకా ప్రార్థనలు లేవు',
  'prayers.emptyMessage': 'పైన ప్రార్థన అభ్యర్థన చేర్చండి — మీకు మాత్రమే కనిపిస్తుంది.',
  'prayers.loadError': 'ప్రార్థనలు లోడ్ కాలేదు',
  'prayers.loadErrorMessage': 'కనెక్షన్ చూసి మళ్లీ ప్రయత్నించండి.',
  'prayers.markAnswered': 'జవాబు వచ్చినట్లు గుర్తించండి',
  'prayers.markUnanswered': 'జవాబు రాలేదని గుర్తించండి',
  'prayers.answered': 'జవాబు వచ్చింది',
  'prayers.deleteLabel': 'ఈ ప్రార్థనను తొలగించండి',
  'prayers.deleteConfirmTitle': 'ఈ ప్రార్థనను తొలగించాలా?',
  'prayers.deleteConfirmMessage': 'ఇది తిరిగి పొందలేరు.',

  'community.title': 'సమాజం',
  'community.empty': 'ఇంకా పోస్ట్‌లు లేవు',
  'community.emptyMessage': 'చర్చి సమాజ పోస్ట్‌లు ఇక్కడ కనిపిస్తాయి.',
  'community.loadError': 'సమాజ పోస్ట్‌లు లోడ్ కాలేదు.',

  'announcements.empty': 'ఇంకా ప్రకటనలు లేవు',
  'announcements.emptyMessage': 'చర్చి ప్రకటనలు ఇక్కడ కనిపిస్తాయి.',
  'announcements.loadError': 'ప్రకటనలు లోడ్ కాలేదు.',

  'dailyVerse.title': 'నేటి వచనం',
  'dailyVerse.today': 'నేడు',
  'dailyVerse.archive': 'గత వచనాలు',
  'dailyVerse.empty': 'ఇంకా వచనం లేదు',
  'dailyVerse.emptyMessage': 'నేటి వచనం ప్రచురించిన తర్వాత ఇక్కడ కనిపిస్తుంది.',

  'notifications.title': 'నోటిఫికేషన్‌లు',
  'notifications.empty': 'మీకు ఇంకా నోటిఫికేషన్‌లు లేవు.',
  'notifications.readError': 'ఈ ఫోన్‌లో మీ నోటిఫికేషన్ చరిత్రను చదవలేకపోయాము.',

  'auth.signInTitle': '{app}లోకి సైన్ ఇన్ అవ్వండి',
  'auth.signUpTitle': 'మీ {app} ఖాతాను సృష్టించండి',
  'auth.email': 'ఇమెయిల్',
  'auth.emailPlaceholder': 'you@example.com',
  'auth.password': 'పాస్‌వర్డ్',
  'auth.passwordPlaceholder': 'పాస్‌వర్డ్ ({min}+ అక్షరాలు)',
  'auth.namePlaceholder': 'మీ పేరు',
  'auth.signIn': 'సైన్ ఇన్',
  'auth.createAccount': 'ఖాతా సృష్టించండి',
  'auth.sendResetLink': 'రీసెట్ లింక్ పంపండి',
  'auth.forgotPassword': 'పాస్‌వర్డ్ మర్చిపోయారా?',
  'auth.newHere': 'కొత్తవారా? ఖాతా సృష్టించండి',
  'auth.backToSignIn': 'సైన్ ఇన్‌కు తిరిగి',
  'auth.resetTitle': 'మీ పాస్‌వర్డ్ రీసెట్ చేయండి',
  'auth.resetSent': 'ఆ ఇమెయిల్‌కు ఖాతా ఉంటే, పాస్‌వర్డ్ రీసెట్ లింక్ పంపబడుతుంది.',
  'auth.continueWithGoogle': 'Googleతో కొనసాగించండి',
  'auth.continueWithApple': 'Appleతో కొనసాగించండి',

  'profile.title': 'ప్రొఫైల్',
  'profile.displayName': 'పేరు',
  'profile.emailLabel': 'ఇమెయిల్',
  'profile.edit': 'మార్చండి',
  'profile.notSet': 'ఇవ్వలేదు',
  'profile.emailVerified': 'ధృవీకరించబడింది',
  'profile.emailUnverified': 'ధృవీకరించలేదు',
  'profile.changePhoto': 'ఫోటో మార్చండి',
  'profile.saveFailed': 'మీ మార్పులు సేవ్ కాలేదు. మళ్లీ ప్రయత్నించండి.',

  'settings.title': 'సెట్టింగ్‌లు',
  'settings.language': 'భాష',
  'settings.languageEnglish': 'ఇంగ్లీష్',
  'settings.languageTelugu': 'తెలుగు',
  'settings.switchTo': 'మార్చండి',
  'settings.theme': 'థీమ్',
  'settings.themeDark': 'డార్క్',
  'settings.themeLight': 'లైట్',
  'settings.notifications': 'నోటిఫికేషన్‌లు',
  'settings.about': 'గురించి',
  'settings.privacyPolicy': 'గోప్యతా విధానం',
  'settings.terms': 'సేవా నిబంధనలు',
  'settings.logOut': 'లాగ్ అవుట్',
  'settings.account': 'ఖాతా',
  'settings.contactChurch': 'చర్చిని సంప్రదించండి',
  'settings.notSetYet': 'ఇంకా ఇవ్వలేదు',
  'settings.bibleTranslations': 'బైబిల్ అనువాదాలు',
  'settings.view': 'చూడండి',

  'songs.loadError': 'పాటలు లోడ్ చేయలేకపోయాము.',
  'songs.emptyShort': 'ఇంకా పాటలు లేవు.',
  'plans.loadErrorShort': 'పఠన ప్రణాళికలు లోడ్ చేయలేకపోయాము.',
  'bible.previous': 'మునుపటి',
  'bible.next': 'తదుపరి',
  'dailyVerse.noneToday': 'నేటికి వచనం ఇంకా ఇవ్వలేదు',
  'dailyVerse.noneTodayMessage':
    'మీ చర్చి నేటి వచనాన్ని పోస్ట్ చేసినప్పుడు ఇక్కడ కనిపిస్తుంది.',
  'dailyVerse.noPast': 'ఇంకా గత వచనాలు లేవు',
  'dailyVerse.noPastMessage': 'వచనాలు రోజురోజుకూ ఇక్కడ చేరుతాయి.',
  'profile.resendVerification': 'ధృవీకరణ ఇమెయిల్ మళ్లీ పంపండి',
  'events.loadErrorShort': 'కార్యక్రమాలు లోడ్ చేయలేకపోయాము.',
  'community.loadErrorShort': 'పోస్ట్‌లు లోడ్ చేయలేకపోయాము.',
  'plans.emptyShort': 'ఇంకా పఠన ప్రణాళికలు లేవు.',
  'community.emptyShort': 'ఇంకా సమాజ పోస్ట్‌లు లేవు.',
  'profile.loadError': 'మీ ప్రొఫైల్ లోడ్ చేయలేకపోయాము.',
  'profile.phoneNumber': 'ఫోన్ నంబర్',
  'events.openInMaps': 'మ్యాప్స్‌లో తెరవండి',
  'events.emptyShort': 'రాబోయే కార్యక్రమాలు లేవు.',
  'bible.chapterLoadError': 'ఈ అధ్యాయం లోడ్ చేయలేకపోయాము.',
  'bible.chapterNotFound': 'అధ్యాయం కనబడలేదు.',
  'dailyVerse.noneTodayShort': 'నేటికి వచనం ఇంకా ఇవ్వలేదు.',
  'announcements.loadErrorShort': 'ప్రకటనలు లోడ్ చేయలేకపోయాము.',
  'announcements.emptyShort': 'ఇంకా ప్రకటనలు లేవు.',
  'home.profileLabel': 'మీ ప్రొఫైల్ తెరవండి',
  'home.profileHint': 'మీ ఖాతా వివరాలను చూపుతుంది',
  'home.announcementsLabel': 'ప్రకటనలు తెరవండి',
  'home.announcementsHint': 'చర్చి ప్రకటనలను చూపుతుంది',
  'home.readingPlan': 'పఠన ప్రణాళిక',
  'home.startAPlan': 'పఠన ప్రణాళిక ప్రారంభించండి',
  'home.percentComplete': '{percent}%',
  'announcements.title': 'ప్రకటనలు',
};

export const CATALOGUES: Record<BibleLanguage, Strings> = { en, te };

/**
 * Looks up `key` in `language`, substituting `{name}` placeholders.
 *
 * Interpolation is deliberately minimal -- `{current}`, `{total}`,
 * `{query}`, `{min}`, `{percent}` and `{app}` are the only placeholders
 * any string uses. `{app}` is the product name, which lives in
 * ../theme/brand.ts rather than being written into each catalogue --
 * so renaming the product does not mean re-translating a sentence. A missing
 * key cannot happen (Strings is a closed interface both catalogues must
 * satisfy), so there is no fallback branch to hide a mistake.
 */
export function translate(
  language: BibleLanguage,
  key: StringKey,
  vars?: Record<string, string | number>
): string {
  const template = CATALOGUES[language][key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole
  );
}
