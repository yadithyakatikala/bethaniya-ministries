/**
 * The app's icons: forty-nine glyphs on a 24-point grid.
 *
 * Drawn for the approved design system (marks and icons): a 1.75 stroke,
 * round caps and joins, no fills except a play triangle and the dots of
 * "more". They are plain vector data drawn by react-native-svg (already
 * bundled for the opening), tinted in code with one colour -- so there is
 * no icon library, no font, no image file and no new dependency, and an
 * icon takes the ink, the muted ink or the gold of whatever it sits in.
 *
 * Names follow what the glyph MEANS in the app, not how it looks.
 * `chev` points right (a row that opens something); use `chevd` / `chevu`
 * for disclosure and `back` for the way out of a screen. Tab icons:
 * `home`, `bible`, `prayer`, `people` (Community) and `you`.
 */
export type IconShape =
  | { t: 'path'; d: string; fill?: true }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: true }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx: number };

export const ICON_SHAPES = {
  home: [
    {
      t: 'path',
      d: 'M3.8 11 12 4l8.2 7v8.2c0 .5-.4.8-.8.8H15v-5.2H9V20H4.6c-.4 0-.8-.3-.8-.8z',
    },
  ],
  bible: [
    { t: 'path', d: 'M12 6.6c-1.7-1.4-4.2-2-7.4-1.7v12.3c3.2-.3 5.6.3 7.4 1.8' },
    { t: 'path', d: 'M12 6.6c1.7-1.4 4.2-2 7.4-1.7v12.3c-3.2-.3-5.6.3-7.4 1.8' },
    { t: 'path', d: 'M12 6.6v12.4' },
  ],
  prayer: [
    {
      t: 'path',
      d: 'M12 21c-3.3-1.5-5.3-4-5.3-7.2 0-2.7 1-5.2 2.7-7.2.6-.7 1.7-.4 1.9.5l.7 2.7',
    },
    {
      t: 'path',
      d: 'M12 21c3.3-1.5 5.3-4 5.3-7.2 0-2.7-1-5.2-2.7-7.2-.6-.7-1.7-.4-1.9.5l-.7 2.7',
    },
    { t: 'path', d: 'M12 9.7v7.6' },
  ],
  people: [
    { t: 'circle', cx: 9, cy: 8.6, r: 3.1 },
    { t: 'path', d: 'M3.4 19.2c.3-3.3 2.7-5.2 5.6-5.2s5.3 1.9 5.6 5.2' },
    { t: 'circle', cx: 17.2, cy: 9.4, r: 2.5 },
    { t: 'path', d: 'M16.2 14.2c2.7-.2 4.7 1.4 5 4.4' },
  ],
  you: [
    { t: 'circle', cx: 12, cy: 8.4, r: 3.7 },
    { t: 'path', d: 'M4.8 20c.5-4 3.4-6.2 7.2-6.2s6.7 2.2 7.2 6.2' },
  ],
  announce: [
    {
      t: 'path',
      d: 'M5.4 5h13.2c.8 0 1.4.6 1.4 1.4v8.2c0 .8-.6 1.4-1.4 1.4H12l-4.6 3.6V16H5.4c-.8 0-1.4-.6-1.4-1.4V6.4C4 5.6 4.6 5 5.4 5z',
    },
    { t: 'path', d: 'M8 9.2h8M8 12.2h5' },
  ],
  bell: [
    { t: 'path', d: 'M6.5 16.8h11l-1.3-1.9V10.4a4.2 4.2 0 0 0-8.4 0v4.5z' },
    { t: 'path', d: 'M10.2 19.4a1.9 1.9 0 0 0 3.6 0' },
  ],
  sliders: [
    { t: 'path', d: 'M4 7h9M17 7h3M4 17h3M11 17h9' },
    { t: 'circle', cx: 15, cy: 7, r: 2 },
    { t: 'circle', cx: 9, cy: 17, r: 2 },
  ],
  search: [
    { t: 'circle', cx: 10.5, cy: 10.5, r: 5.8 },
    { t: 'path', d: 'm15 15 5 5' },
  ],
  close: [{ t: 'path', d: 'M6 6l12 12M18 6 6 18' }],
  more: [
    { t: 'circle', cx: 5.5, cy: 12, r: 1.4, fill: true },
    { t: 'circle', cx: 12, cy: 12, r: 1.4, fill: true },
    { t: 'circle', cx: 18.5, cy: 12, r: 1.4, fill: true },
  ],
  back: [{ t: 'path', d: 'M14.6 5.6 8.2 12l6.4 6.4' }],
  chev: [{ t: 'path', d: 'M9.4 5.6 15.8 12l-6.4 6.4' }],
  chevd: [{ t: 'path', d: 'M5.6 9.4 12 15.8l6.4-6.4' }],
  chevu: [{ t: 'path', d: 'M5.6 14.6 12 8.2l6.4 6.4' }],
  arrow: [
    { t: 'path', d: 'M5 12h13.4' },
    { t: 'path', d: 'M13.2 6.8 18.4 12l-5.2 5.2' },
  ],
  plus: [{ t: 'path', d: 'M12 5v14M5 12h14' }],
  minus: [{ t: 'path', d: 'M5.5 12h13' }],
  check: [{ t: 'path', d: 'M5.5 12.6 10 17l8.5-9.6' }],
  checkc: [
    { t: 'circle', cx: 12, cy: 12, r: 8.4 },
    { t: 'path', d: 'm8.4 12.300 2.500 2.500 4.700-5' },
  ],
  share: [
    { t: 'path', d: 'M12 3.6v11.2' },
    { t: 'path', d: 'M8.2 7.3 12 3.6l3.8 3.7' },
    { t: 'path', d: 'M6.2 11.2v7.1c0 .9.7 1.6 1.6 1.6h8.4c.9 0 1.6-.7 1.6-1.6v-7.1' },
  ],
  copy: [
    { t: 'rect', x: 8.6, y: 8.6, w: 10.4, h: 10.4, rx: 2.2 },
    {
      t: 'path',
      d: 'M15.4 8.6V6.9c0-1-.8-1.9-1.9-1.9H6.9C5.8 5 5 5.9 5 6.9v6.6c0 1 .8 1.9 1.9 1.9h1.7',
    },
  ],
  bookmark: [
    { t: 'path', d: 'M7 4.6h10c.5 0 .8.3.8.8V20l-5.8-3.8L6.2 20V5.4c0-.5.3-.8.8-.8z' },
  ],
  note: [
    {
      t: 'path',
      d: 'M6 4.6h12c.6 0 1 .4 1 1v13.8c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1V5.6c0-.6.4-1 1-1z',
    },
    { t: 'path', d: 'M8.6 9.2h6.8M8.6 12.4h6.8M8.6 15.6h4' },
  ],
  highlight: [
    { t: 'path', d: 'm14.2 5.2 4.6 4.6-7.6 7.6H6.6v-4.6z' },
    { t: 'path', d: 'M4.5 20.5h15' },
  ],
  edit: [
    {
      t: 'path',
      d: 'm5 19 .9-3.8L16.6 4.5a1.8 1.8 0 0 1 2.6 0l.3.3a1.8 1.8 0 0 1 0 2.6L8.8 18.1z',
    },
    { t: 'path', d: 'm14.6 6.5 2.9 2.9' },
  ],
  trash: [
    { t: 'path', d: 'M5 7h14M10 7V5h4v2M7 7l.8 12h8.400L17 7' },
    { t: 'path', d: 'M10 11v5M14 11v5' },
  ],
  comment: [
    {
      t: 'path',
      d: 'M5.2 5.2h13.6c.8 0 1.4.6 1.4 1.4v8.4c0 .8-.6 1.4-1.4 1.4H11l-4.2 3.4V16.4H5.2c-.8 0-1.4-.6-1.4-1.4V6.6c0-.8.6-1.4 1.4-1.4z',
    },
  ],
  msg: [
    {
      t: 'path',
      d: 'M5.2 5.2h13.6c.8 0 1.4.6 1.4 1.4v8.4c0 .8-.6 1.4-1.4 1.4H11l-4.2 3.4V16.4H5.2c-.8 0-1.4-.6-1.4-1.4V6.6c0-.8.6-1.4 1.4-1.4z',
    },
  ],
  send: [
    { t: 'path', d: 'M5 12 19.5 5l-4 14-3.700-5.300z' },
    { t: 'path', d: 'm11.800 13.700 3.700-4.300' },
  ],
  heart: [
    {
      t: 'path',
      d: 'M12 19.8s-7.2-4.4-7.2-9.6A4.1 4.1 0 0 1 12 7.7a4.1 4.1 0 0 1 7.2 2.5c0 5.2-7.2 9.6-7.2 9.6z',
    },
  ],
  heartf: [
    {
      t: 'path',
      d: 'M12 19.8s-7.2-4.4-7.2-9.6A4.1 4.1 0 0 1 12 7.7a4.1 4.1 0 0 1 7.2 2.5c0 5.2-7.2 9.6-7.2 9.6z',
    },
  ],
  play: [{ t: 'path', d: 'M8.6 6.4v11.2L17.6 12z', fill: true }],
  pause: [{ t: 'path', d: 'M9 6.500v11M15 6.500v11' }],
  restart: [
    { t: 'path', d: 'M5.500 12a6.500 6.500 0 1 0 2-4.700' },
    { t: 'path', d: 'M5.500 5.500v3.700h3.700' },
  ],
  refresh: [
    { t: 'path', d: 'M19 11a7 7 0 1 0-1.900 5.500' },
    { t: 'path', d: 'M19 5.500V11h-5.500' },
  ],
  external: [
    { t: 'path', d: 'M13.500 5H19v5.500' },
    { t: 'path', d: 'm19 5-8 8' },
    {
      t: 'path',
      d: 'M17 14v4a1.500 1.500 0 0 1-1.500 1.500h-9A1.500 1.500 0 0 1 5 18V9a1.500 1.500 0 0 1 1.500-1.500H10',
    },
  ],
  photo: [
    { t: 'rect', x: 3.8, y: 5.2, w: 16.4, h: 13.6, rx: 2.4 },
    { t: 'circle', cx: 9, cy: 10.2, r: 1.6 },
    { t: 'path', d: 'm4.5 17 4.6-4.4 3.4 3 3-2.6 4.5 4' },
  ],
  music: [
    { t: 'path', d: 'M9 18V6.2l9.5-2v11.6' },
    { t: 'circle', cx: 6.6, cy: 18, r: 2.4 },
    { t: 'circle', cx: 16.1, cy: 15.8, r: 2.4 },
  ],
  calendar: [
    { t: 'rect', x: 4, y: 5.5, w: 16, h: 14.5, rx: 2.4 },
    { t: 'path', d: 'M4 10h16M8.5 3.5v4M15.5 3.5v4' },
  ],
  globe: [
    { t: 'circle', cx: 12, cy: 12, r: 8.2 },
    {
      t: 'path',
      d: 'M3.8 12h16.4M12 3.8c2.3 2.2 3.5 4.9 3.5 8.2s-1.2 6-3.5 8.2c-2.3-2.2-3.5-4.9-3.5-8.2s1.2-6 3.5-8.2z',
    },
  ],
  pin: [
    {
      t: 'path',
      d: 'M12 20.6s6.2-5.3 6.2-10.4a6.2 6.2 0 1 0-12.4 0c0 5.1 6.2 10.4 6.2 10.4z',
    },
    { t: 'circle', cx: 12, cy: 10.2, r: 2.2 },
  ],
  lock: [
    { t: 'rect', x: 5.5, y: 10.5, w: 13, h: 9.5, rx: 2 },
    { t: 'path', d: 'M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5' },
  ],
  alert: [
    { t: 'path', d: 'M12 4.2 21 19.5H3z' },
    { t: 'path', d: 'M12 10v4.4M12 16.9v.2' },
  ],
  info: [
    { t: 'circle', cx: 12, cy: 12, r: 8.4 },
    { t: 'path', d: 'M12 11v5M12 8v.2' },
  ],
  sun: [
    { t: 'circle', cx: 12, cy: 12, r: 3.6 },
    {
      t: 'path',
      d: 'M12 3.6v2M12 18.4v2M3.6 12h2M18.4 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18',
    },
  ],
  logout: [
    { t: 'path', d: 'M10 4.5H6.5c-.6 0-1 .4-1 1v13c0 .6.4 1 1 1H10' },
    { t: 'path', d: 'm14.5 8 4.500 4-4.500 4M19 12H9.500' },
  ],
  plans: [
    { t: 'rect', x: 4.8, y: 4.8, w: 14.4, h: 14.4, rx: 3.2 },
    { t: 'path', d: 'm8.6 12.3 2.5 2.5 4.4-5' },
  ],
  user: [
    { t: 'circle', cx: 12, cy: 8.4, r: 3.7 },
    { t: 'path', d: 'M4.8 20c.5-4 3.4-6.2 7.2-6.2s6.7 2.2 7.2 6.2' },
  ],
} as const satisfies Record<string, readonly IconShape[]>;

export type IconName = keyof typeof ICON_SHAPES;

export const ICON_NAMES = Object.keys(ICON_SHAPES) as IconName[];
