import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

/**
 * The navigation container ref, in its own module.
 *
 * WHY IT MOVED HERE (M3). It used to live in ./AppNavigator.tsx, which
 * meant ../services/notifications/notificationService.ts -- a service --
 * imported a screen-tree module to reach it. That closed a runtime
 * import cycle: theme/index -> useTheme -> PreferencesContext ->
 * notificationService -> AppNavigator -> theme/index. Nothing read a
 * cyclic binding during module init, so the app worked, but the cycle
 * surfaced the moment M3 widened the theme barrel: a test importing
 * tokens through it got a half-initialised module.
 *
 * The `RootStackParamList` import above is `import type`, which
 * TypeScript erases, so this module adds no runtime edge back to
 * AppNavigator and the cycle is gone rather than merely reordered.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
