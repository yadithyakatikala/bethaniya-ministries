/**
 * `firebase/auth`'s package.json exports map lists a "types" key ahead of
 * (and separate from) its "react-native" condition, and TypeScript always
 * treats "types" as an active condition -- so tsc resolves this module's
 * declarations from a single platform-generic .d.ts no matter which
 * runtime build (node/react-native/browser) actually gets bundled. Metro
 * correctly resolves the React Native build at runtime (see
 * services/firebase/app.ts), which does export getReactNativePersistence
 * (see node_modules/@firebase/auth/dist/rn/index.js) -- this augmentation
 * only describes that existing runtime export to tsc; it does not add or
 * change any behavior.
 */
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence;
}
