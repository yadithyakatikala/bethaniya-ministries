/**
 * Digits as people actually type them. A member on a Telugu keyboard may
 * type Telugu numerals (౩౪), and a phone in another locale Devanagari or
 * Arabic-Indic ones; all of them are the number they meant. Everything
 * else passes through untouched.
 */
export function toAsciiDigits(input: string): string {
  return input.replace(
    /[\u0c66-\u0c6f\u0966-\u096f\u0660-\u0669\u06f0-\u06f9]/g,
    (ch) => {
      const code = ch.charCodeAt(0);
      const zero =
        code >= 0x0c66 && code <= 0x0c6f
          ? 0x0c66
          : code >= 0x0966 && code <= 0x096f
            ? 0x0966
            : code >= 0x0660 && code <= 0x0669
              ? 0x0660
              : 0x06f0;
      return String(code - zero);
    }
  );
}
