/**
 * The product's own identity: its name, and the seam its brand imagery
 * loads through.
 *
 * ---------------------------------------------------------------------
 * WHY A MODULE FOR ONE STRING
 * ---------------------------------------------------------------------
 * The V1 name was written out longhand in nine places across the mobile
 * app and the admin dashboard -- two auth screen literals, two catalogue
 * entries per language, a Home fallback, the Expo manifest, the admin
 * sidebar twice, the admin login page and the admin page title. Renaming
 * the product meant finding all of them, and missing one meant shipping
 * two names. This is the single place the mobile app reads it from.
 *
 * NOT A TECHNICAL IDENTIFIER. Everything the platforms and Firebase key
 * off keeps its V1 value forever, because changing any of them would
 * orphan existing installs, accounts and data:
 *
 *   Android package / iOS bundle   com.bethaniyaministries.app
 *   Expo slug                      bethaniya-ministries
 *   Deep-link schemes              bethaniyaministries, com.bethaniyaministries.app
 *   Firebase project ids           bethaniyaministries-production, …-dev-58588
 *   Release signing properties     BETHANIYA_UPLOAD_*
 *   Firestore collection/field names
 *
 * Those are plumbing, not branding, and no user ever sees them.
 *
 * ---------------------------------------------------------------------
 * CHURCH NAME IS A DIFFERENT THING
 * ---------------------------------------------------------------------
 * `PRODUCT_NAME` is the app. The CHURCH's name is content an admin types
 * into the dashboard and lives in Firestore at `settings/church`; Home
 * renders that, not this. `DEFAULT_CHURCH_NAME` below is only the
 * fallback for a deployment where no settings document has ever been
 * saved -- it is what a brand-new install shows before an admin has
 * configured anything, so it is the product name rather than any
 * particular congregation's.
 */

/** The user-facing product name. The only place it is defined for mobile. */
export const PRODUCT_NAME = 'Maranatha';

/**
 * What Home shows when no church settings document exists yet. An
 * existing deployment's saved church name is untouched and still wins --
 * see ../features/auth/HomeScreen.tsx.
 */
export const DEFAULT_CHURCH_NAME = PRODUCT_NAME;
