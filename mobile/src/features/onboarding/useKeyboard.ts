import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Whether the soft keyboard is up, and how tall it is.
 *
 * iOS announces the keyboard BEFORE it moves (`Will`), so the screen can
 * start rearranging in step with it; Android only reports it after (`Did`).
 */
export function useKeyboard(): { visible: boolean; height: number } {
  const [state, setState] = useState({ visible: false, height: 0 });

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(show, (event) =>
      setState({ visible: true, height: event.endCoordinates?.height ?? 0 })
    );
    const hidden = Keyboard.addListener(hide, () =>
      setState({ visible: false, height: 0 })
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return state;
}
