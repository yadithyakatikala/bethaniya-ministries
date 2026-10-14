# The admin site's design system

How the admin site looks, why, and the handful of parts every page is built
from. If you are adding or changing a page, read "Building a page" first.

The admin is an operator's tool, not the congregation's reading app, so it has
its own look: **deep navy for structure, warm ivory for the ground, a
restrained gold for emphasis**. What it shares with the mobile app is
*meaning* — the green/amber/red/blue status colours and the brand gold — not
every surface colour.

---

## The look in six lines

| | |
| --- | --- |
| **Navy** (`#0F1B30`) | Structure: the left rail, primary buttons, the strongest chip, selected states. |
| **Ivory** (`#F7F4EC`) | The page ground. White cards sit on it with a hairline edge and **no shadow**. Only things that float (menus, dialogs) cast one. |
| **Gold** | An accent, never a fill: the focus ring, links, the short rule under a page title, the tab indicator, the marker beside the selected menu item, the bar on a "showing now" card. |
| **Type** | Hind Guntur for the interface (it covers Telugu, which this site edits); Noto Serif for headings and for a verse. Both are self-hosted (`public/fonts`), nothing is fetched from a font service. |
| **Shape** | Controls 8 px, cards 12 px. Controls are 44 px tall. |
| **Contrast** | Every colour pair a component uses is asserted against WCAG AA in `src/theme/__tests__/tokens.test.ts`; input edges are held to 3:1. |

All values live in `src/theme/tokens.ts`; `src/theme/theme.ts` turns them into
the MUI theme. A page is restyled by being rendered, never by being edited for
colour: **do not write a hex colour in a page** — use `adminColors`.

---

## Building a page

Every page is one of three shapes.

### A list (announcements, songs, events, plans…)

```tsx
<PageContainer testId="songs-list-page">
  <AdminPageHeader title="Songs" subtitle="One sentence of what this is." action={<NewButton />} />
  {error && <Alert severity="error">…</Alert>}
  {!rows && !error && <TableSkeleton testId="songs-loading" label="Loading songs" />}
  {rows?.length === 0 && <AdminEmptyState title="No songs yet" message="What fills it." testId="songs-empty" />}
  {rows?.length > 0 && (
    <AdminTableCard>
      <TableContainer><Table>…<StatusChip status="published" />…</Table></TableContainer>
    </AdminTableCard>
  )}
</PageContainer>
```

### A form (create / edit)

`PageContainer width="narrow"` → `AdminPageHeader` with a breadcrumb →
`FormCard` → fields → `FormActions` (the primary button first, then Cancel).
Use `FormSection` to break a long form into titled parts. Use `ImageField`,
`AudioField`, `VideoLinkField` for files (see [MEDIA_UPLOADS.md](./MEDIA_UPLOADS.md))
and `DateTimeField` for a moment in time (it names the time zone).

### A page of blocks (the dashboard, the Verse of the Day)

`PageContainer` → `AdminPageHeader` → one or more `SectionCard`s. A
`SectionCard` is a labelled region with a serif heading; give the *one* card
that answers the page's question `accent` (the gold bar).

---

## The shared parts (`src/components/ui`, `src/components`)

| Part | Use it for |
| --- | --- |
| `PageContainer` | The wrapper every page sits in. Decides the gutter (16 px on a phone, up to 40 px), the measure (`narrow` 760, `default` 1120, `wide` 1360) and the vertical rhythm. |
| `AdminPageHeader` | The page's only `<h1>`, the gold rule, an optional sentence, breadcrumbs, and the primary actions on the right. |
| `SectionCard` | A titled block on a page. |
| `StatusChip` | A **publication** state: Draft, Scheduled, Published, Archived, Live. |
| `ToneChip` | Any other small label, in a named tone (`neutral`, `navy`, `navyTint`, `gold`, `success`, `warning`, `danger`, `info`, `archived`, `outlined`). The role, account-state and report-status chips are built on it. |
| `AdminTableCard` | The bordered card a table sits in. **Gives its table a 640 px floor** so a phone scrolls the card sideways instead of crushing the columns. |
| `TableSkeleton` | A loading placeholder in the shape of a list. |
| `AdminEmptyState` | What a list says when it is empty — a title, a sentence, and (if there is one) the button that fills it. |
| `FormCard`, `FormSection`, `FormActions` | The form shell. |
| `DateTimeField` | A date and time, naming the viewer's time zone. |
| `ConfirmDialog` | Any destructive or visible-to-everyone action. Escape cancels; both buttons freeze while it runs. |
| `useToast` | A short confirmation or error after an action. |
| `formatDate`, `formatDateTime` | The one way a date is written: `14 Oct 2026`, `14 Oct 2026, 18:10`. A missing date is a dash, never "null". |

---

## The rules that keep it accessible

1. **A word, a shape, and a colour.** A status is never colour alone. Every
   chip says its state in text, and a chip that stands for a *state* carries an
   icon whose shape differs from every other state's (the icon is hidden from a
   screen reader so the word is heard once).
2. **Headings are real.** One `<h1>` per page (the header). Cards are labelled
   regions.
3. **Touch targets are 44 px.** An icon-only button needs an `aria-label`,
   and it should name the thing as well as the action ("Delete Easter
   service") where the page has more than one.
4. **Focus is visible** — a 2 px gold ring on every control.
5. **Nothing is lost on a phone.** The page never scrolls sideways; a table
   scrolls inside its card; a row of buttons wraps beneath its title.
6. **Long words wrap, columns do not collapse.** In a table cell use
   `overflow-wrap: break-word`, **not** `anywhere` — `anywhere` lets a column
   shrink to one letter wide.

## What to avoid

- A new `Paper` with its own radius or padding. Use `SectionCard` / `FormCard`
  / `AdminTableCard`.
- A raw MUI `Chip` with `color="success"`. Use `StatusChip` or `ToneChip`.
- `toLocaleString()` for a date. Use `formatDate` / `formatDateTime`.
- A spinner for a list. Use `TableSkeleton`.
- A page with no `PageContainer`, or with its own `p: 4`.

---

## What guards it

- `src/theme/__tests__/tokens.test.ts` — the contrast pairs, the shared
  status colours, the radii and the layout measure.
- `src/components/ui/__tests__/` — every shared part, including the table floor
  and the one-way date format.
- Each page's own tests check its text, its states and its permissions.
- A look at every page in a real browser, at laptop and phone width, for each
  role — done when this design was applied, and worth repeating after a big
  change (no horizontal scroll, no console errors, no crushed columns).
