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
  /**
   * The BODY text for an absent chapter. Deliberately different wording
   * from the badge above it -- printing the same sentence twice, one
   * under the other, reads as a bug rather than as an explanation.
   */
  'bible.notInTranslationHelp': string;
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
  /** The PRIVATE journal at users/{uid}/prayers -- named apart from the
   *  shared wall so the two rows cannot be mistaken for each other. */
  'more.myPrayerJournal': string;
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

  // --- M2: independent app / Bible language ---------------------------
  /** The two Settings rows. Deliberately NOT both called "Language": the
   *  whole point of M2 is that they are different settings, and a shared
   *  label is how a user ends up changing the wrong one. */
  'settings.appLanguage': string;
  'settings.appLanguageHelp': string;
  'settings.bibleLanguage': string;
  'settings.bibleLanguageHelp': string;
  'bible.modeTelugu': string;
  'bible.modeEnglish': string;
  'bible.modeBilingual': string;
  'bible.bookNotFound': string;

  // --- M2: strings that were hardcoded English literals ---------------
  'common.liveNow': string;
  /** Stands in for a name when a member has no display name, email or phone. */
  'common.member': string;
  'events.dateTBA': string;
  'events.unsupportedStreamLink': string;
  'songs.favoriteAction': string;
  'songs.favoritedState': string;
  'dailyVerse.loadError': string;
  'profile.saved': string;
  'profile.nameEmpty': string;
  'profile.nameSaveFailed': string;
  'profile.photoPermissionRequired': string;
  'profile.photoMustBeImage': string;
  'profile.photoTooLarge': string;
  'profile.verificationSent': string;

  // --- M4: the immersive Bible reader ---------------------------------
  'common.close': string;
  'common.done': string;
  /** The third theme option. Light and Dark already existed. */
  'settings.themeSystem': string;
  /** Opens the saved reading position -- see
   *  ../services/firebase/readingPosition.ts. */
  'bible.continueReading': string;
  /** The accessibility label for the scripture surface, whose tap shows
   *  and hides the reader's chrome. */
  'bible.toggleControls': string;
  'bible.readingSettings': string;
  'bible.chapterSelector': string;
  'bible.selectBook': string;
  'bible.selectChapter': string;
  'bible.verseActions': string;
  'bible.highlight': string;
  'bible.removeHighlight': string;
  'bible.bookmark': string;
  'bible.removeBookmark': string;
  'bible.addNote': string;
  'bible.editNote': string;
  'bible.deleteNote': string;
  'bible.notePlaceholder': string;
  'bible.share': string;
  'bible.copy': string;
  'bible.copied': string;
  'bible.copyFailed': string;
  'bible.shareFailed': string;
  'bible.saveFailed': string;
  /**
   * The four highlight colours are NAMED, not shown as four unlabelled
   * swatches. They sit at the same lightness by design (see
   * ../theme/tokens.ts's highlightTints), so hue alone does not
   * distinguish them for a colour-blind reader.
   */
  'bible.highlightYellow': string;
  'bible.highlightGreen': string;
  'bible.highlightBlue': string;
  'bible.highlightPink': string;
  /** Spoken state for a verse, so selection / highlighting / a note is
   *  never communicated by colour alone. */
  'bible.highlighted': string;
  'bible.bookmarked': string;
  'bible.hasNote': string;
  'bible.signInToSave': string;
  'bible.fontLabel': string;
  'bible.fontSerif': string;
  'bible.fontSans': string;
  'bible.sizeLabel': string;
  'bible.decreaseSize': string;
  'bible.increaseSize': string;
  'bible.lineHeightLabel': string;
  'bible.lineHeightCompact': string;
  'bible.lineHeightNormal': string;
  'bible.lineHeightRelaxed': string;
  'bible.widthLabel': string;
  'bible.widthNarrow': string;
  'bible.widthNormal': string;
  'bible.widthWide': string;
  'bible.layoutLabel': string;
  'bible.layoutStacked': string;
  'bible.layoutSideBySide': string;

  // --- M5: automated Verse of the Day + Prophet Verse -----------------
  /** Accessibility label for an override's illustration. The automated
   *  paths carry no image. */
  'dailyVerse.imageLabel': string;
  /**
   * Shown when not even the bundled fallback could be resolved -- which
   * should not happen, and is guarded by a test. Deliberately NOT
   * 'dailyVerse.noneTodayShort' ("no verse set for today"), which is now
   * wrong: with automation there is always a verse to show.
   */
  'dailyVerse.unavailable': string;
  'dailyVerse.loading': string;
  /** The Prophet Verse is a SEPARATE content system, with its own
   *  section heading below the Verse of the Day. */
  'prophetVerse.title': string;
  'prophetVerse.imageLabel': string;
  /** Shown when the church has not published one yet -- see
   *  ../features/prophet-verses/ProphetVerseCard.tsx. */
  'prophetVerse.empty': string;
  'prophetVerse.emptyMessage': string;

  // --- M8: suspension ---------------------------------------------------
  /**
   * The screen a suspended member sees instead of the app.
   *
   * It says what has happened and, for a temporary suspension, when it
   * ends -- and nothing else. The REASON an administrator recorded is
   * deliberately not shown: it is an internal note written for other
   * administrators, and putting it on this screen would turn every such
   * note into something the member reads.
   */
  'suspended.title': string;
  'suspended.permanentMessage': string;
  'suspended.temporaryMessage': string;
  /** The end of a temporary suspension. `{when}` is a formatted date. */
  'suspended.until': string;
  'suspended.canStillRead': string;
  'suspended.contactChurch': string;
  'suspended.signOut': string;

  // --- M6 -------------------------------------------------------------
  /**
   * Shown on the Settings screen when a preference was saved on this
   * device but could not be written to the member's account.
   *
   * BUG 1 and BUG 2 stayed invisible for exactly as long as this string
   * did not exist: the write was denied, the context swallowed the
   * rejection, and the setting appeared to undo itself. The local value
   * is authoritative and still in effect, so this reports what happened
   * rather than asking the member to do anything about it.
   */
  'settings.syncFailed': string;

  // --- M6: first-login onboarding -------------------------------------
  /** The screen's heading. Warm, not administrative: this is the first
   *  thing a new member sees after signing in. */
  'onboarding.title': string;
  'onboarding.subtitle': string;
  'onboarding.fullName': string;
  'onboarding.fullNamePlaceholder': string;
  'onboarding.fullNameError': string;
  'onboarding.phone': string;
  'onboarding.phonePlaceholder': string;
  /** Says plainly that no code is coming -- people expect an OTP the
   *  moment they are asked for a number, and there is none. */
  'onboarding.phoneHelp': string;
  'onboarding.phoneError': string;
  'onboarding.gender': string;
  'onboarding.genderMale': string;
  'onboarding.genderFemale': string;
  'onboarding.genderError': string;
  'onboarding.language': string;
  /** States what the choice does NOT change, for the same reason the two
   *  Settings language rows do. */
  'onboarding.languageHelp': string;
  'onboarding.submit': string;
  'onboarding.skip': string;
  'onboarding.saveFailed': string;
  /** The Profile row that leads back here for anyone who skipped. */
  'onboarding.completePrompt': string;
  'onboarding.completeAction': string;

  // --- M6: the media feed ---------------------------------------------
  'media.title': string;
  /** The Home section heading, above a short preview row. */
  'media.sectionTitle': string;
  'media.empty': string;
  'media.emptyMessage': string;
  'media.loadError': string;
  'media.loadingMore': string;
  'media.like': string;
  'media.unlike': string;
  'media.liked': string;
  'media.comment': string;
  'media.comments': string;
  'media.share': string;
  'media.save': string;
  'media.unsave': string;
  'media.saved': string;
  'media.savedTitle': string;
  'media.savedEmpty': string;
  'media.savedEmptyMessage': string;
  /** Shown when a signed-out visitor taps Like, Save or Comment. Share
   *  is deliberately absent -- it needs no account. */
  'media.signInRequired': string;
  'media.commentPlaceholder': string;
  'media.postComment': string;
  'media.commentFailed': string;
  'media.noComments': string;
  'media.deleteComment': string;
  'media.playVideo': string;
  'media.imageLabel': string;
  'media.openPost': string;
  'media.actionFailed': string;
  /** M7: "Posted 3 March 2026", under a card. */
  'media.publishedOn': string;
  'media.refresh': string;

  // --- M7: the group chat ----------------------------------------------
  // NOT `community.*`: that prefix belongs to the admin-authored posts
  // feature (see ../features/community/CommunityListScreen.tsx), which is
  // a different thing in a different collection. Two features, two
  // prefixes, so neither can borrow the other's wording by accident.
  'chat.title': string;
  'chat.sectionTitle': string;
  'chat.placeholder': string;
  'chat.send': string;
  'chat.empty': string;
  'chat.emptyMessage': string;
  'chat.loadError': string;
  'chat.loadErrorMessage': string;
  'chat.loadOlder': string;
  'chat.loadingOlder': string;
  'chat.sendFailed': string;
  /** The tombstone left where an administrator removed a message. */
  'chat.removed': string;
  'chat.deleteLabel': string;
  'chat.deleteConfirmTitle': string;
  'chat.deleteConfirmMessage': string;
  'chat.you': string;
  'chat.sending': string;
  /** Screen-reader label for one message: who said it, and what. */
  'chat.messageLabel': string;

  // --- M7: the shared prayer wall --------------------------------------
  // Distinct from `prayers.*`, which is the PRIVATE prayer journal at
  // users/{uid}/prayers. A member can use either or both.
  'prayerWall.title': string;
  'prayerWall.sectionTitle': string;
  'prayerWall.newRequest': string;
  'prayerWall.editRequest': string;
  'prayerWall.titleLabel': string;
  'prayerWall.titlePlaceholder': string;
  'prayerWall.bodyLabel': string;
  'prayerWall.bodyPlaceholder': string;
  'prayerWall.categoryLabel': string;
  'prayerWall.categoryNone': string;
  'prayerWall.category.healing': string;
  'prayerWall.category.family': string;
  'prayerWall.category.guidance': string;
  'prayerWall.category.thanksgiving': string;
  'prayerWall.category.provision': string;
  'prayerWall.category.other': string;
  /** The word shown in place of a name. Never a stored value. */
  'prayerWall.anonymousLabel': string;
  'prayerWall.anonymousToggle': string;
  'prayerWall.anonymousHelp': string;
  /** Shown while editing: the choice cannot be undone afterwards. */
  'prayerWall.anonymousLocked': string;
  'prayerWall.submit': string;
  'prayerWall.submitFailed': string;
  'prayerWall.titleRequired': string;
  'prayerWall.bodyRequired': string;
  'prayerWall.empty': string;
  'prayerWall.emptyMessage': string;
  'prayerWall.loadError': string;
  'prayerWall.loadErrorMessage': string;
  'prayerWall.loadingMore': string;
  'prayerWall.refresh': string;
  'prayerWall.status.open': string;
  'prayerWall.status.answered': string;
  'prayerWall.status.closed': string;
  'prayerWall.markAnswered': string;
  'prayerWall.reopen': string;
  'prayerWall.edit': string;
  'prayerWall.yours': string;
  'prayerWall.deleteConfirmTitle': string;
  'prayerWall.deleteConfirmMessage': string;
  'prayerWall.removed': string;
  'prayerWall.signInRequired': string;

  // --- M7: reporting ----------------------------------------------------
  'report.action': string;
  'report.title': string;
  'report.intro': string;
  'report.reasonLabel': string;
  'report.reason.spam': string;
  'report.reason.harassment': string;
  'report.reason.hate': string;
  'report.reason.sexual': string;
  'report.reason.violence': string;
  'report.reason.misinformation': string;
  'report.reason.other': string;
  'report.detailsLabel': string;
  'report.detailsPlaceholder': string;
  'report.submit': string;
  'report.submitted': string;
  'report.submittedMessage': string;
  'report.alreadyReported': string;
  'report.failed': string;

  // --- M7: a suspended account ------------------------------------------
  'account.suspendedTitle': string;
  'account.suspendedMessage': string;

  // --- Community as a place, not just a list of posts -------------------
  // The Community screen is the church's social area; the posts below are
  // one part of it, and the chat and the media feed are the others.
  'community.introMessage': string;
  'community.postsSection': string;
  'community.goToChat': string;
  'community.goToChatHint': string;
  'community.goToMedia': string;
  'community.goToMediaHint': string;
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
  'bible.notInTranslationHelp':
    'Switch the Bible language in Settings to read this chapter in the other translation.',
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
  'more.myPrayerJournal': 'My prayer journal',
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

  'settings.appLanguage': 'App language',
  'settings.appLanguageHelp':
    'Changes the app’s buttons, menus and messages. Does not change the Bible.',
  'settings.bibleLanguage': 'Bible language',
  'settings.bibleLanguageHelp':
    'Changes the Bible text, book names and search. Does not change the app’s language.',
  'bible.modeTelugu': 'Telugu',
  'bible.modeEnglish': 'English',
  'bible.modeBilingual': 'English + Telugu',
  'bible.bookNotFound': 'Book not found.',

  'common.liveNow': 'LIVE NOW',
  'common.member': 'Member',
  'events.dateTBA': 'Date and time to be announced',
  'events.unsupportedStreamLink':
    'This stream link isn’t a supported YouTube URL, so it can’t be played here.',
  'songs.favoriteAction': 'Favourite',
  'songs.favoritedState': 'Favourited',
  'dailyVerse.loadError': 'Could not load today’s verse.',
  'profile.saved': 'Saved.',
  'profile.nameEmpty': 'Your name cannot be empty.',
  'profile.nameSaveFailed': 'Could not save your name. Please try again.',
  'profile.photoPermissionRequired':
    'Photo library access is required to change your profile photo.',
  'profile.photoMustBeImage': 'Please choose an image file.',
  'profile.photoTooLarge': 'Please choose an image smaller than 5MB.',
  'profile.verificationSent': 'Verification email sent. Check your inbox.',

  'common.close': 'Close',
  'common.done': 'Done',
  'settings.themeSystem': 'System',
  'bible.continueReading': 'Continue reading',
  'bible.toggleControls': 'Scripture. Tap to show or hide the reading controls.',
  'bible.readingSettings': 'Reading settings',
  'bible.chapterSelector': 'Choose a chapter',
  'bible.selectBook': 'Book',
  'bible.selectChapter': 'Chapter',
  'bible.verseActions': 'Verse actions',
  'bible.highlight': 'Highlight',
  'bible.removeHighlight': 'Remove highlight',
  'bible.bookmark': 'Bookmark',
  'bible.removeBookmark': 'Remove bookmark',
  'bible.addNote': 'Add note',
  'bible.editNote': 'Edit note',
  'bible.deleteNote': 'Delete note',
  'bible.notePlaceholder': 'Your note on this verse',
  'bible.share': 'Share',
  'bible.copy': 'Copy',
  'bible.copied': 'Copied to the clipboard.',
  'bible.copyFailed': 'Could not copy this verse.',
  'bible.shareFailed': 'Could not share this verse.',
  'bible.saveFailed': 'Could not save your change.',
  'bible.highlightYellow': 'Yellow',
  'bible.highlightGreen': 'Green',
  'bible.highlightBlue': 'Blue',
  'bible.highlightPink': 'Pink',
  'bible.highlighted': 'Highlighted',
  'bible.bookmarked': 'Bookmarked',
  'bible.hasNote': 'Has a note',
  'bible.signInToSave': 'Sign in to save highlights, bookmarks and notes.',
  'bible.fontLabel': 'Typeface',
  'bible.fontSerif': 'Serif',
  'bible.fontSans': 'Sans',
  'bible.sizeLabel': 'Text size',
  'bible.decreaseSize': 'Smaller text',
  'bible.increaseSize': 'Larger text',
  'bible.lineHeightLabel': 'Line spacing',
  'bible.lineHeightCompact': 'Compact',
  'bible.lineHeightNormal': 'Comfortable',
  'bible.lineHeightRelaxed': 'Spacious',
  'bible.widthLabel': 'Column width',
  'bible.widthNarrow': 'Narrower',
  'bible.widthNormal': 'Default',
  'bible.widthWide': 'Wider',
  'bible.layoutLabel': 'Bilingual layout',
  'bible.layoutStacked': 'Stacked',
  'bible.layoutSideBySide': 'Side by side',

  // --- M5 ---
  'dailyVerse.imageLabel': "Illustration for today's verse",
  'dailyVerse.unavailable': "Today's verse could not be loaded.",
  'dailyVerse.loading': "Loading today's verse",
  // "of the Day" is load-bearing: this block sits directly under the
  // Verse of the Day, and a tester could not tell the two apart.
  'prophetVerse.title': 'Prophet Verse of the Day',
  'prophetVerse.imageLabel': 'Illustration for this prophet verse',
  'prophetVerse.empty': 'No prophet verse today',
  'prophetVerse.emptyMessage':
    'When the church shares one, it will appear here beneath the Verse of the Day.',

  // --- M8: suspension ---
  'suspended.title': 'Your account is suspended',
  'suspended.permanentMessage':
    'A church administrator has suspended this account. You can use the app again once an administrator restores access.',
  'suspended.temporaryMessage':
    'A church administrator has suspended this account for a while. It will unlock by itself when the time is up.',
  'suspended.until': 'Until {when}',
  'suspended.canStillRead':
    'Nothing has been deleted, and you are still signed in.',
  'suspended.contactChurch':
    'If you think this is a mistake, please speak to someone at your church.',
  'suspended.signOut': 'Sign out',

  // --- M6 ---
  'settings.syncFailed':
    'Saved on this device. We could not sync it to your account just now.',

  'onboarding.title': 'Welcome to {app}',
  'onboarding.subtitle':
    'A few details, so the church knows who you are. You can change any of these later in your profile.',
  'onboarding.fullName': 'Full name',
  'onboarding.fullNamePlaceholder': 'Your name',
  'onboarding.fullNameError': 'Please enter your name.',
  'onboarding.phone': 'Phone number',
  'onboarding.phonePlaceholder': '98765 43210',
  'onboarding.phoneHelp':
    'So the church can reach you. We will not send you a code, and this is not used to sign in.',
  'onboarding.phoneError': 'Please enter a valid phone number.',
  'onboarding.gender': 'Gender',
  'onboarding.genderMale': 'Male',
  'onboarding.genderFemale': 'Female',
  'onboarding.genderError': 'Please choose one.',
  'onboarding.language': 'Preferred language',
  'onboarding.languageHelp':
    'Sets the language of the app. You can choose your Bible language separately in Settings.',
  'onboarding.submit': 'Continue',
  'onboarding.skip': 'Not now',
  'onboarding.saveFailed': 'We could not save your details. Please try again.',
  'onboarding.completePrompt': 'Finish setting up your profile',
  'onboarding.completeAction': 'Complete',

  'media.title': 'Media',
  'media.sectionTitle': 'Latest media',
  'media.empty': 'Nothing here yet',
  'media.emptyMessage': 'The church has not posted any media yet.',
  'media.loadError': 'Media could not be loaded.',
  'media.loadingMore': 'Loading more',
  'media.like': 'Like',
  'media.unlike': 'Remove like',
  'media.liked': 'Liked',
  'media.comment': 'Comment',
  'media.comments': 'Comments',
  'media.share': 'Share',
  'media.save': 'Save',
  'media.unsave': 'Remove from saved',
  'media.saved': 'Saved',
  'media.savedTitle': 'Saved media',
  'media.savedEmpty': 'Nothing saved yet',
  'media.savedEmptyMessage': 'Media you save will appear here.',
  'media.signInRequired':
    'Sign in to like, save and comment. You can keep browsing and sharing without an account.',
  'media.commentPlaceholder': 'Write a comment',
  'media.postComment': 'Post',
  'media.commentFailed': 'Your comment could not be posted.',
  'media.noComments': 'No comments yet.',
  'media.deleteComment': 'Delete comment',
  'media.playVideo': 'Play video',
  'media.imageLabel': 'Media image',
  'media.openPost': 'Open post',
  'media.actionFailed': 'That did not work. Please try again.',
  'media.publishedOn': 'Posted {date}',
  'media.refresh': 'Refresh',

  'chat.title': 'Church chat',
  'chat.sectionTitle': 'Church chat',
  'chat.placeholder': 'Write a message',
  'chat.send': 'Send',
  'chat.empty': 'No messages yet',
  'chat.emptyMessage': 'Say hello to the church family.',
  'chat.loadError': 'Chat could not be loaded',
  'chat.loadErrorMessage': 'Check your connection and try again.',
  'chat.loadOlder': 'Load earlier messages',
  'chat.loadingOlder': 'Loading earlier messages…',
  'chat.sendFailed': 'Your message was not sent.',
  'chat.removed': 'This message was removed.',
  'chat.deleteLabel': 'Delete your message',
  'chat.deleteConfirmTitle': 'Delete this message?',
  'chat.deleteConfirmMessage': 'It will be removed for everyone. This cannot be undone.',
  'chat.you': 'You',
  'chat.sending': 'Sending…',
  'chat.messageLabel': '{name} said: {text}',

  'prayerWall.title': 'Prayer requests',
  'prayerWall.sectionTitle': 'Prayer requests',
  'prayerWall.newRequest': 'Ask for prayer',
  'prayerWall.editRequest': 'Edit your request',
  'prayerWall.titleLabel': 'Subject',
  'prayerWall.titlePlaceholder': 'What would you like prayer for?',
  'prayerWall.bodyLabel': 'Details',
  'prayerWall.bodyPlaceholder': 'Tell the church as much as you would like to share.',
  'prayerWall.categoryLabel': 'Category',
  'prayerWall.categoryNone': 'No category',
  'prayerWall.category.healing': 'Healing',
  'prayerWall.category.family': 'Family',
  'prayerWall.category.guidance': 'Guidance',
  'prayerWall.category.thanksgiving': 'Thanksgiving',
  'prayerWall.category.provision': 'Provision',
  'prayerWall.category.other': 'Other',
  'prayerWall.anonymousLabel': 'Anonymous',
  'prayerWall.anonymousToggle': 'Post anonymously',
  'prayerWall.anonymousHelp':
    'Your name is not saved with this request and nobody in the church can see who wrote it.',
  'prayerWall.anonymousLocked': 'Whether this request shows your name cannot be changed.',
  'prayerWall.submit': 'Share request',
  'prayerWall.submitFailed': 'Your request could not be shared.',
  'prayerWall.titleRequired': 'Please write a subject.',
  'prayerWall.bodyRequired': 'Please write a little more.',
  'prayerWall.empty': 'No requests yet',
  'prayerWall.emptyMessage': 'Be the first to ask the church to pray with you.',
  'prayerWall.loadError': 'Requests could not be loaded',
  'prayerWall.loadErrorMessage': 'Check your connection and try again.',
  'prayerWall.loadingMore': 'Loading more…',
  'prayerWall.refresh': 'Refresh',
  'prayerWall.status.open': 'Praying',
  'prayerWall.status.answered': 'Answered',
  'prayerWall.status.closed': 'Closed',
  'prayerWall.markAnswered': 'Mark answered',
  'prayerWall.reopen': 'Still praying',
  'prayerWall.edit': 'Edit',
  'prayerWall.yours': 'Your request',
  'prayerWall.deleteConfirmTitle': 'Delete this request?',
  'prayerWall.deleteConfirmMessage': 'It will be removed for everyone. This cannot be undone.',
  'prayerWall.removed': 'This request was removed.',
  'prayerWall.signInRequired': 'Sign in to share a prayer request.',

  'report.action': 'Report',
  'report.title': 'Report this',
  'report.intro': 'A church administrator will look at this. Your name is not shown to anyone else.',
  'report.reasonLabel': 'Why are you reporting it?',
  'report.reason.spam': 'Spam or advertising',
  'report.reason.harassment': 'Harassment or bullying',
  'report.reason.hate': 'Hateful language',
  'report.reason.sexual': 'Sexual content',
  'report.reason.violence': 'Violence or threats',
  'report.reason.misinformation': 'False information',
  'report.reason.other': 'Something else',
  'report.detailsLabel': 'Anything else we should know? (optional)',
  'report.detailsPlaceholder': 'Add a little detail',
  'report.submit': 'Send report',
  'report.submitted': 'Thank you',
  'report.submittedMessage': 'A church administrator will look at this.',
  'report.alreadyReported': 'Reported',
  'report.failed': 'Your report could not be sent.',

  'account.suspendedTitle': 'Posting is paused',
  'account.suspendedMessage':
    'A church administrator has paused posting on your account. You can still read everything. Please speak to the church office.',

  'community.introMessage': 'Everything the church family shares, in one place.',
  'community.postsSection': 'From the church',
  'community.goToChat': 'Church chat',
  'community.goToChatHint': 'Talk with the whole church',
  'community.goToMedia': 'Photos and videos',
  'community.goToMediaHint': 'Pictures and clips from church life',
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
  'bible.notInTranslationHelp':
    'ఈ అధ్యాయాన్ని మరో అనువాదంలో చదవడానికి సెట్టింగ్‌లలో బైబిల్ భాషను మార్చండి.',
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
  'more.myPrayerJournal': 'నా ప్రార్థన పుస్తకం',
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

  'settings.appLanguage': 'యాప్ భాష',
  'settings.appLanguageHelp':
    'యాప్‌లోని బటన్‌లు, మెనూలు, సందేశాలను మారుస్తుంది. బైబిల్‌ను మార్చదు.',
  'settings.bibleLanguage': 'బైబిల్ భాష',
  'settings.bibleLanguageHelp':
    'బైబిల్ వచనం, పుస్తకాల పేర్లు, వెతుకుడును మారుస్తుంది. యాప్ భాషను మార్చదు.',
  'bible.modeTelugu': 'తెలుగు',
  'bible.modeEnglish': 'ఇంగ్లీష్',
  'bible.modeBilingual': 'ఇంగ్లీష్ + తెలుగు',
  'bible.bookNotFound': 'పుస్తకం కనబడలేదు.',

  'common.liveNow': 'ప్రత్యక్ష ప్రసారం',
  'common.member': 'సభ్యుడు',
  'events.dateTBA': 'తేదీ, సమయం తరువాత ప్రకటిస్తాము',
  'events.unsupportedStreamLink':
    'ఈ ప్రసార లింక్ మద్దతు ఉన్న YouTube URL కాదు, అందుకే ఇక్కడ ప్లే చేయలేము.',
  'songs.favoriteAction': 'ఇష్టమైనది',
  'songs.favoritedState': 'ఇష్టమైనవిలో ఉంది',
  'dailyVerse.loadError': 'నేటి వచనం లోడ్ చేయలేకపోయాము.',
  'profile.saved': 'సేవ్ అయింది.',
  'profile.nameEmpty': 'మీ పేరు ఖాళీగా ఉండకూడదు.',
  'profile.nameSaveFailed': 'మీ పేరు సేవ్ కాలేదు. మళ్లీ ప్రయత్నించండి.',
  'profile.photoPermissionRequired':
    'ప్రొఫైల్ ఫోటో మార్చడానికి ఫోటో లైబ్రరీ అనుమతి కావాలి.',
  'profile.photoMustBeImage': 'దయచేసి ఒక చిత్ర ఫైల్‌ను ఎంచుకోండి.',
  'profile.photoTooLarge': 'దయచేసి 5MB కంటే చిన్న చిత్రాన్ని ఎంచుకోండి.',
  'profile.verificationSent': 'ధృవీకరణ ఇమెయిల్ పంపాము. మీ ఇన్‌బాక్స్ చూడండి.',

  'common.close': 'మూసివేయండి',
  'common.done': 'పూర్తయింది',
  'settings.themeSystem': 'సిస్టమ్',
  'bible.continueReading': 'చదవడం కొనసాగించండి',
  'bible.toggleControls': 'వాక్యభాగం. నియంత్రణలు చూపించడానికి లేదా దాచడానికి తట్టండి.',
  'bible.readingSettings': 'చదివే అమరికలు',
  'bible.chapterSelector': 'అధ్యాయం ఎంచుకోండి',
  'bible.selectBook': 'గ్రంథం',
  'bible.selectChapter': 'అధ్యాయం',
  'bible.verseActions': 'వచనంపై చర్యలు',
  'bible.highlight': 'హైలైట్ చేయండి',
  'bible.removeHighlight': 'హైలైట్ తీసివేయండి',
  'bible.bookmark': 'బుక్‌మార్క్ చేయండి',
  'bible.removeBookmark': 'బుక్‌మార్క్ తీసివేయండి',
  'bible.addNote': 'నోట్ జోడించండి',
  'bible.editNote': 'నోట్ సవరించండి',
  'bible.deleteNote': 'నోట్ తొలగించండి',
  'bible.notePlaceholder': 'ఈ వచనంపై మీ నోట్',
  'bible.share': 'పంచుకోండి',
  'bible.copy': 'కాపీ చేయండి',
  'bible.copied': 'క్లిప్‌బోర్డ్‌కు కాపీ అయింది.',
  'bible.copyFailed': 'ఈ వచనాన్ని కాపీ చేయలేకపోయాము.',
  'bible.shareFailed': 'ఈ వచనాన్ని పంచుకోలేకపోయాము.',
  'bible.saveFailed': 'మీ మార్పును సేవ్ చేయలేకపోయాము.',
  'bible.highlightYellow': 'పసుపు',
  'bible.highlightGreen': 'ఆకుపచ్చ',
  'bible.highlightBlue': 'నీలం',
  'bible.highlightPink': 'గులాబీ',
  'bible.highlighted': 'హైలైట్ చేయబడింది',
  'bible.bookmarked': 'బుక్‌మార్క్ చేయబడింది',
  'bible.hasNote': 'నోట్ ఉంది',
  'bible.signInToSave':
    'హైలైట్‌లు, బుక్‌మార్క్‌లు, నోట్‌లు సేవ్ చేయడానికి సైన్ ఇన్ అవ్వండి.',
  'bible.fontLabel': 'అక్షర శైలి',
  'bible.fontSerif': 'సెరిఫ్',
  'bible.fontSans': 'సాన్స్',
  'bible.sizeLabel': 'అక్షర పరిమాణం',
  'bible.decreaseSize': 'చిన్న అక్షరాలు',
  'bible.increaseSize': 'పెద్ద అక్షరాలు',
  'bible.lineHeightLabel': 'పంక్తుల అంతరం',
  'bible.lineHeightCompact': 'తక్కువ',
  'bible.lineHeightNormal': 'మధ్యస్థం',
  'bible.lineHeightRelaxed': 'ఎక్కువ',
  'bible.widthLabel': 'వరుస వెడల్పు',
  'bible.widthNarrow': 'సన్నం',
  'bible.widthNormal': 'సాధారణం',
  'bible.widthWide': 'వెడల్పు',
  'bible.layoutLabel': 'ద్విభాషా అమరిక',
  'bible.layoutStacked': 'ఒకదానిపై ఒకటి',
  'bible.layoutSideBySide': 'ప్రక్కప్రక్కన',

  // --- M5 ---
  'dailyVerse.imageLabel': 'నేటి వచనానికి చిత్రం',
  'dailyVerse.unavailable': 'నేటి వచనం లోడ్ కాలేదు.',
  'dailyVerse.loading': 'నేటి వచనం లోడ్ అవుతోంది',
  'prophetVerse.title': 'ఈ రోజు ప్రవక్త వచనం',
  'prophetVerse.imageLabel': 'ఈ ప్రవక్త వచనానికి చిత్రం',
  'prophetVerse.empty': 'ఈ రోజు ప్రవక్త వచనం లేదు',
  'prophetVerse.emptyMessage':
    'సంఘం పంచుకున్నప్పుడు, అది ఈ రోజు వచనం క్రింద ఇక్కడ కనిపిస్తుంది.',

  // --- M8: suspension ---
  'suspended.title': 'మీ ఖాతా నిలిపివేయబడింది',
  'suspended.permanentMessage': 'ఒక సంఘ నిర్వాహకుడు ఈ ఖాతాను నిలిపివేశారు. నిర్వాహకుడు తిరిగి అనుమతించిన తర్వాత మీరు యాప్‌ను మళ్లీ ఉపయోగించవచ్చు.',
  'suspended.temporaryMessage': 'ఒక సంఘ నిర్వాహకుడు ఈ ఖాతాను కొంత కాలం పాటు నిలిపివేశారు. సమయం ముగిసిన వెంటనే ఇది దానంతట అదే తెరుచుకుంటుంది.',
  'suspended.until': '{when} వరకు',
  'suspended.canStillRead': 'ఏదీ తొలగించబడలేదు, మీరు ఇంకా సైన్ ఇన్‌లోనే ఉన్నారు.',
  'suspended.contactChurch': 'ఇది పొరపాటు అని మీరు భావిస్తే, దయచేసి మీ సంఘంలో ఎవరితోనైనా మాట్లాడండి.',
  'suspended.signOut': 'సైన్ అవుట్',

  // --- M6 ---
  'settings.syncFailed':
    'ఈ పరికరంలో సేవ్ అయింది. ప్రస్తుతం దాన్ని మీ ఖాతాకు సింక్ చేయలేకపోయాం.',

  'onboarding.title': '{app}కు స్వాగతం',
  'onboarding.subtitle':
    'మీరు ఎవరో చర్చికి తెలియడం కోసం కొన్ని వివరాలు. వీటిని తర్వాత మీ ప్రొఫైల్‌లో మార్చుకోవచ్చు.',
  'onboarding.fullName': 'పూర్తి పేరు',
  'onboarding.fullNamePlaceholder': 'మీ పేరు',
  'onboarding.fullNameError': 'దయచేసి మీ పేరు నమోదు చేయండి.',
  'onboarding.phone': 'ఫోన్ నంబర్',
  'onboarding.phonePlaceholder': '98765 43210',
  'onboarding.phoneHelp':
    'చర్చి మిమ్మల్ని సంప్రదించడానికి. మేము ఏ కోడ్ పంపం, ఇది సైన్ ఇన్ కోసం కాదు.',
  'onboarding.phoneError': 'దయచేసి సరైన ఫోన్ నంబర్ నమోదు చేయండి.',
  'onboarding.gender': 'లింగం',
  'onboarding.genderMale': 'పురుషుడు',
  'onboarding.genderFemale': 'స్త్రీ',
  'onboarding.genderError': 'దయచేసి ఒకటి ఎంపిక చేయండి.',
  'onboarding.language': 'ఇష్టమైన భాష',
  'onboarding.languageHelp':
    'యాప్ భాషను సెట్ చేస్తుంది. బైబిల్ భాషను సెట్టింగ్స్‌లో వేరేగా ఎంచుకోవచ్చు.',
  'onboarding.submit': 'కొనసాగండి',
  'onboarding.skip': 'ఇప్పుడు వద్దు',
  'onboarding.saveFailed': 'మీ వివరాలను సేవ్ చేయలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.',
  'onboarding.completePrompt': 'మీ ప్రొఫైల్ సెటప్ పూర్తి చేయండి',
  'onboarding.completeAction': 'పూర్తి చేయండి',

  'media.title': 'మీడియా',
  'media.sectionTitle': 'తాజా మీడియా',
  'media.empty': 'ఇక్కడ ఇంకా ఏమీ లేదు',
  'media.emptyMessage': 'చర్చి ఇంకా ఏ మీడియాను పోస్ట్ చేయలేదు.',
  'media.loadError': 'మీడియాను లోడ్ చేయలేకపోయాం.',
  'media.loadingMore': 'మరిన్ని లోడ్ చేస్తోంది',
  'media.like': 'ఇష్టం',
  'media.unlike': 'ఇష్టం తీసివేయండి',
  'media.liked': 'ఇష్టపడ్డారు',
  'media.comment': 'వ్యాఖ్య',
  'media.comments': 'వ్యాఖ్యలు',
  'media.share': 'షేర్ చేయండి',
  'media.save': 'సేవ్ చేయండి',
  'media.unsave': 'సేవ్ నుండి తీసివేయండి',
  'media.saved': 'సేవ్ చేసారు',
  'media.savedTitle': 'సేవ్ చేసిన మీడియా',
  'media.savedEmpty': 'ఏమీ సేవ్ చేయలేదు',
  'media.savedEmptyMessage': 'మీరు సేవ్ చేసిన మీడియా ఇక్కడ కనిపిస్తుంది.',
  'media.signInRequired':
    'ఇష్టం, సేవ్, వ్యాఖ్య కోసం సైన్ ఇన్ చేయండి. ఖాతా లేకుండానే చూడవచ్చు, షేర్ చేయవచ్చు.',
  'media.commentPlaceholder': 'వ్యాఖ్య రాయండి',
  'media.postComment': 'పోస్ట్',
  'media.commentFailed': 'మీ వ్యాఖ్యను పోస్ట్ చేయలేకపోయాం.',
  'media.noComments': 'ఇంకా వ్యాఖ్యలు లేవు.',
  'media.deleteComment': 'వ్యాఖ్యను తొలగించండి',
  'media.playVideo': 'వీడియో ప్లే చేయండి',
  'media.imageLabel': 'మీడియా చిత్రం',
  'media.openPost': 'పోస్ట్ తెరవండి',
  'media.actionFailed': 'అది పని చేయలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.',
  'media.publishedOn': '{date}న పోస్ట్ చేయబడింది',
  'media.refresh': 'రిఫ్రెష్ చేయండి',

  'chat.title': 'సంఘ సంభాషణ',
  'chat.sectionTitle': 'సంఘ సంభాషణ',
  'chat.placeholder': 'సందేశం రాయండి',
  'chat.send': 'పంపండి',
  'chat.empty': 'ఇంకా సందేశాలు లేవు',
  'chat.emptyMessage': 'సంఘ కుటుంబానికి పలకరింపు చెప్పండి.',
  'chat.loadError': 'సంభాషణను లోడ్ చేయలేకపోయాం',
  'chat.loadErrorMessage': 'మీ కనెక్షన్‌ను చూసి మళ్లీ ప్రయత్నించండి.',
  'chat.loadOlder': 'పాత సందేశాలను చూడండి',
  'chat.loadingOlder': 'పాత సందేశాలు లోడ్ అవుతున్నాయి…',
  'chat.sendFailed': 'మీ సందేశం పంపబడలేదు.',
  'chat.removed': 'ఈ సందేశం తొలగించబడింది.',
  'chat.deleteLabel': 'మీ సందేశాన్ని తొలగించండి',
  'chat.deleteConfirmTitle': 'ఈ సందేశాన్ని తొలగించాలా?',
  'chat.deleteConfirmMessage':
    'ఇది అందరి నుండి తొలగించబడుతుంది. దీనిని తిరిగి పొందలేరు.',
  'chat.you': 'మీరు',
  'chat.sending': 'పంపుతోంది…',
  'chat.messageLabel': '{name} చెప్పారు: {text}',

  'prayerWall.title': 'ప్రార్థన విన్నపాలు',
  'prayerWall.sectionTitle': 'ప్రార్థన విన్నపాలు',
  'prayerWall.newRequest': 'ప్రార్థన కోరండి',
  'prayerWall.editRequest': 'మీ విన్నపాన్ని సవరించండి',
  'prayerWall.titleLabel': 'విషయం',
  'prayerWall.titlePlaceholder': 'దేని కోసం ప్రార్థన కావాలి?',
  'prayerWall.bodyLabel': 'వివరాలు',
  'prayerWall.bodyPlaceholder': 'మీరు పంచుకోదలచినంత సంఘానికి తెలియజేయండి.',
  'prayerWall.categoryLabel': 'విభాగం',
  'prayerWall.categoryNone': 'విభాగం లేదు',
  'prayerWall.category.healing': 'స్వస్థత',
  'prayerWall.category.family': 'కుటుంబం',
  'prayerWall.category.guidance': 'నడిపింపు',
  'prayerWall.category.thanksgiving': 'కృతజ్ఞతాస్తుతులు',
  'prayerWall.category.provision': 'అవసరాలు',
  'prayerWall.category.other': 'ఇతరం',
  'prayerWall.anonymousLabel': 'పేరు లేకుండా',
  'prayerWall.anonymousToggle': 'పేరు లేకుండా పంచుకోండి',
  'prayerWall.anonymousHelp':
    'ఈ విన్నపంతో మీ పేరు భద్రపరచబడదు, ఎవరు రాశారో సంఘంలో ఎవరికీ తెలియదు.',
  'prayerWall.anonymousLocked': 'ఈ విన్నపంలో మీ పేరు కనిపించడాన్ని ఇక మార్చలేరు.',
  'prayerWall.submit': 'విన్నపాన్ని పంచుకోండి',
  'prayerWall.submitFailed': 'మీ విన్నపాన్ని పంచుకోలేకపోయాం.',
  'prayerWall.titleRequired': 'దయచేసి ఒక విషయం రాయండి.',
  'prayerWall.bodyRequired': 'దయచేసి కొంచెం ఎక్కువ రాయండి.',
  'prayerWall.empty': 'ఇంకా విన్నపాలు లేవు',
  'prayerWall.emptyMessage': 'సంఘం మీతో కలిసి ప్రార్థించేలా మొదటివారు మీరే అవ్వండి.',
  'prayerWall.loadError': 'విన్నపాలను లోడ్ చేయలేకపోయాం',
  'prayerWall.loadErrorMessage': 'మీ కనెక్షన్‌ను చూసి మళ్లీ ప్రయత్నించండి.',
  'prayerWall.loadingMore': 'మరిన్ని లోడ్ అవుతున్నాయి…',
  'prayerWall.refresh': 'రిఫ్రెష్ చేయండి',
  'prayerWall.status.open': 'ప్రార్థిస్తున్నాం',
  'prayerWall.status.answered': 'జవాబు దొరికింది',
  'prayerWall.status.closed': 'ముగిసింది',
  'prayerWall.markAnswered': 'జవాబు దొరికిందని గుర్తించండి',
  'prayerWall.reopen': 'ఇంకా ప్రార్థిస్తున్నాం',
  'prayerWall.edit': 'సవరించండి',
  'prayerWall.yours': 'మీ విన్నపం',
  'prayerWall.deleteConfirmTitle': 'ఈ విన్నపాన్ని తొలగించాలా?',
  'prayerWall.deleteConfirmMessage':
    'ఇది అందరి నుండి తొలగించబడుతుంది. దీనిని తిరిగి పొందలేరు.',
  'prayerWall.removed': 'ఈ విన్నపం తొలగించబడింది.',
  'prayerWall.signInRequired': 'ప్రార్థన విన్నపం పంచుకోవడానికి సైన్ ఇన్ చేయండి.',

  'report.action': 'ఫిర్యాదు చేయండి',
  'report.title': 'దీనిపై ఫిర్యాదు',
  'report.intro':
    'సంఘ నిర్వాహకులు దీనిని పరిశీలిస్తారు. మీ పేరు ఇతరులకు కనిపించదు.',
  'report.reasonLabel': 'దేనికి ఫిర్యాదు చేస్తున్నారు?',
  'report.reason.spam': 'స్పామ్ లేదా ప్రకటన',
  'report.reason.harassment': 'వేధింపు',
  'report.reason.hate': 'ద్వేషపూరిత మాటలు',
  'report.reason.sexual': 'లైంగిక విషయం',
  'report.reason.violence': 'హింస లేదా బెదిరింపు',
  'report.reason.misinformation': 'తప్పుడు సమాచారం',
  'report.reason.other': 'మరేదైనా',
  'report.detailsLabel': 'ఇంకేమైనా చెప్పాలనుకుంటున్నారా? (ఐచ్ఛికం)',
  'report.detailsPlaceholder': 'కొంచెం వివరం రాయండి',
  'report.submit': 'ఫిర్యాదు పంపండి',
  'report.submitted': 'ధన్యవాదాలు',
  'report.submittedMessage': 'సంఘ నిర్వాహకులు దీనిని పరిశీలిస్తారు.',
  'report.alreadyReported': 'ఫిర్యాదు చేశారు',
  'report.failed': 'మీ ఫిర్యాదు పంపబడలేదు.',

  'account.suspendedTitle': 'పోస్ట్ చేయడం నిలిపివేయబడింది',
  'account.suspendedMessage':
    'సంఘ నిర్వాహకులు మీ ఖాతాలో పోస్ట్ చేయడాన్ని నిలిపివేశారు. మీరు అన్నీ చదవగలరు. దయచేసి సంఘ కార్యాలయంతో మాట్లాడండి.',

  'community.introMessage': 'సంఘ కుటుంబం పంచుకునేదంతా ఒకే చోట.',
  'community.postsSection': 'సంఘం నుండి',
  'community.goToChat': 'సంఘ సంభాషణ',
  'community.goToChatHint': 'సంఘం మొత్తంతో మాట్లాడండి',
  'community.goToMedia': 'ఫోటోలు, వీడియోలు',
  'community.goToMediaHint': 'సంఘ జీవితంలోని చిత్రాలు, క్లిప్‌లు',
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
