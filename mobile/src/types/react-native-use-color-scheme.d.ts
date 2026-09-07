/**
 * react-native's public `useColorScheme` export (from 'react-native')
 * has types; this is the internal module it re-exports from
 * (react-native/index.js: `get useColorScheme() { return
 * require('./Libraries/Utilities/useColorScheme').default; }`), which
 * ships no declaration file of its own. Day 8's Bible screen tests
 * import this deep path directly so `jest.mock()` can replace the exact
 * module the screens' `import { useColorScheme } from 'react-native'`
 * resolves to, without mocking the whole react-native package (which
 * breaks other native module resolution under jest-expo -- see
 * ChapterScreen.test.tsx and friends for the full reasoning). This
 * augmentation only describes that existing runtime export to tsc.
 */
declare module 'react-native/Libraries/Utilities/useColorScheme' {
  import type { ColorSchemeName } from 'react-native';

  export default function useColorScheme(): ColorSchemeName;
}
