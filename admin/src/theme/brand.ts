/**
 * The admin dashboard's half of the product identity.
 *
 * Mirrors mobile/src/theme/brand.ts deliberately: the two apps are
 * separate builds with no shared package, so the name is defined once per
 * app rather than being written into each component. The V1 name appeared
 * in four places in this app alone -- the sidebar heading, the mobile
 * top-bar heading, the login page and the document title -- and a rename
 * that missed one would have shipped two names.
 *
 * NOT A TECHNICAL IDENTIFIER. The Firebase project ids, the Firestore
 * collection and field names, and the Android/iOS identifiers all keep
 * their V1 values permanently; changing any of them would orphan existing
 * accounts and data. See mobile/src/theme/brand.ts for the full list.
 *
 * The CHURCH's name is separate: it is admin-configured content stored at
 * `settings/church` in Firestore and edited on the Settings page. This
 * constant is the product, not the congregation.
 */

/** The user-facing product name. */
export const PRODUCT_NAME = 'Maranatha';

/** What the dashboard calls itself in headings and the document title. */
export const ADMIN_TITLE = `${PRODUCT_NAME} Admin`;
