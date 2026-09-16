/**
 * Manual Jest mock for 'firebase/app' -- same root-level, auto-applied
 * pattern as ./auth.js / ./firestore.js / ./storage.js (see auth.js's
 * header comment for why this pattern exists: the real package ships ESM
 * that Jest's CommonJS transform cannot parse, so importing it -- even
 * transitively, via src/services/firebase/app.ts -- throws "Cannot use
 * import statement outside a module").
 *
 * Added so src/services/firebase/app.ts itself can be unit tested. That
 * module had no test coverage at all until the emulator-toggle default it
 * owns caused a silent production outage (a release build falling back to
 * emulator mode and pointing every Firebase call at an unreachable
 * localhost) -- see __tests__/app.test.ts.
 */
export const initializeApp = jest.fn((config) => ({ options: config }));
export const getApps = jest.fn(() => []);
