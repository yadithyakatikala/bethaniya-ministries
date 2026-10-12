import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Whether the on-screen keyboard is up.
 *
 * The tab bar uses it to get out of the way: with the keyboard open the bar
 * would ride above it and take a sixty-point strip of a screen that is
 * already short -- the chat's message box is the case the design shows, with
 * the bar gone while the member types. iOS announces the keyboard before it
 * moves (`will`), Android only once it has (`did`).
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(show, () => setVisible(true));
    const hidden = Keyboard.addListener(hide, () => setVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return visible;
}
