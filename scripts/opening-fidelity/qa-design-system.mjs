// Visual QA of the shared design system: the REAL components, in a browser, light / dark / Telugu,
// to be laid beside the approved component sheets. See qa-lib.mjs for what this is and is not.
//
//   node qa-design-system.mjs         # writes out/qa-shots/ds-*__*.png
import path from 'path';
import { DEVICES, MOBILE, OUT, buildQa, launch, openQa } from './qa-lib.mjs';

const T = (p) => JSON.stringify(path.join(MOBILE, 'src', p));

const entry = `
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ScrollView, Text, View } from 'react-native';
import { AuthProvider } from ${T('context/AuthContext')};
import { PreferencesProvider } from ${T('context/PreferencesContext')};
import {
  AppButton, Avatar, Badge, Chip, ConfirmDialog, EmptyState, ErrorState, Icon, ICON_NAMES, IconButton,
  ListGroup, ListRow, LoadingState, NoticeBanner, SectionHeader, SegmentedChoice, Sheet, Skeleton, SkeletonRows,
  TextField, UnderlineTabs, useTheme,
} from ${T('theme')};
import { BrandFish } from ${T('features/opening/BrandFish')};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ gap: 12, paddingVertical: 12 }}>
      <Text style={[type.overline, { color: colors.inkMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

function Gallery() {
  const { colors, type } = useTheme();
  const [seg, setSeg] = React.useState('b');
  const [tab, setTab] = React.useState('requests');
  const [reason, setReason] = React.useState('spam');
  const [shown, setShown] = React.useState(false);
  const [sheet, setSheet] = React.useState(false);
  const [dialog, setDialog] = React.useState(false);
  (globalThis as any).__open = { sheet: () => setSheet(true), dialog: () => setDialog(true), closeAll: () => { setSheet(false); setDialog(false); } };
  const row = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12, alignItems: 'center' as const };
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView testID="gallery" contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
        <Block title="BUTTONS">
          <View style={row}>
            <AppButton title="Ask for prayer" />
            <AppButton title="Cancel" variant="secondary" />
          </View>
          <View style={row}>
            <AppButton title="See all" variant="text" />
            <AppButton title="Delete" variant="destructive" />
            <AppButton title="Share" compact />
          </View>
          <View style={row}>
            <AppButton title="Continue" muted />
            <AppButton title="Continue" disabled />
            <AppButton title="Saving" loading />
            <AppButton title="Loading" variant="secondary" loading />
          </View>
          <AppButton title="Read the chapter" trailingIcon="arrow" fullWidth />
        </Block>
        <Block title="ICON BUTTONS · CHIPS">
          <View style={row}>
            <IconButton variant="outlined" accessibilityLabel="Share" onPress={() => {}}><Icon name="share" size={20} /></IconButton>
            <IconButton variant="outlined" accessibilityLabel="Copy" onPress={() => {}}><Icon name="copy" size={20} /></IconButton>
            <IconButton variant="tinted" accessibilityLabel="Close" onPress={() => {}}><Icon name="close" size={20} /></IconButton>
            <IconButton accessibilityLabel="More" onPress={() => {}}><Icon name="more" size={20} /></IconButton>
            <IconButton variant="outlined" accessibilityLabel="Search" onPress={() => {}}><Icon name="search" size={20} /></IconButton>
          </View>
          <View style={row}>
            <Chip label="Healing" selected onPress={() => {}} />
            <Chip label="Family" onPress={() => {}} />
            <Chip label="Thanksgiving" onPress={() => {}} />
          </View>
        </Block>
        <Block title="TABS">
          <SegmentedChoice testID="seg" selected={seg} onSelect={setSeg}
            options={[{ value: 'a', label: 'English' }, { value: 'b', label: 'Telugu' }]} />
          <SegmentedChoice testID="seg3" selected="c" onSelect={() => {}}
            options={[{ value: 'a', label: 'Light' }, { value: 'b', label: 'Dark' }, { value: 'c', label: 'System' }]} />
          <UnderlineTabs testID="ut" selected={tab} onSelect={setTab}
            tabs={[{ value: 'requests', label: 'Requests' }, { value: 'journal', label: 'My journal' }]} />
          <SegmentedChoice testID="reasons" selected={reason} onSelect={setReason}
            options={[{ value: 'spam', label: 'Spam' }, { value: 'unkind', label: 'Unkind' }, { value: 'private', label: 'Private details' }, { value: 'other', label: 'Something else' }]} />
        </Block>
        <Block title="LISTS">
          <SectionHeader title="From the church" actionLabel="See all" onAction={() => {}} />
          <ListGroup>
            <ListRow leadingIcon="prayer" title="Prayer requests" subtitle="Ask the church to pray with you" onPress={() => {}} />
            <ListRow title="App language" value="English" onPress={() => {}} />
            <ListRow title="Theme" value="System" onPress={() => {}} />
            <ListRow title="Log out" destructive onPress={() => {}} />
          </ListGroup>
        </Block>
        <Block title="BADGES">
          <View style={row}>
            <Badge label="Praying" />
            <Badge label="Answered" variant="success" />
            <Badge label="Paused" variant="warning" />
            <Badge label="Removed" variant="error" />
            <Badge label="LIVE" variant="live" />
            <Badge label="Pinned" variant="featured" />
          </View>
        </Block>
        <Block title="FIELDS">
          <TextField label="Display name" placeholder="Your name" helpText="Shown to the church." />
          <TextField label="Email" defaultValue="you@" error="That is not an email address." />
          <TextField label="Password" secureTextEntry={!shown} defaultValue="secret12"
            toggle={{ shown, onToggle: () => setShown(!shown), showLabel: 'Show', hideLabel: 'Hide' }} />
          <TextField label="Details" multiline placeholder="Say more" />
        </Block>
        <Block title="STATES">
          <EmptyState title="Nothing saved yet" message="Verses you save will appear here." actionLabel="Open the Bible" onAction={() => {}} />
          <EmptyState variant="inline" title="No Prophet Verse today" message="Check back tomorrow." />
          <ErrorState title="We could not load this" message="Check your connection and try again." retryLabel="Try again" onRetry={() => {}} />
          <LoadingState label="Loading…" compact />
          <SkeletonRows count={2} label="Loading requests" />
          <NoticeBanner tone="warning" title="Your account is paused" message="You can still read. Posting is off until the church turns it back on." />
          <NoticeBanner tone="danger" message="We could not save your details." />
        </Block>
        <Block title="AVATARS · FISH · ICONS">
          <View style={row}>
            <Avatar name="Ruth Anand" size={26} />
            <Avatar name="Ruth Anand" size={40} />
            <Avatar name="Ruth Anand" size={96} />
            <Avatar name="రూత్ ఆనంద్" size={96} />
            <BrandFish size={36} />
            <BrandFish size={24} />
          </View>
          <View style={row}>
            {ICON_NAMES.map((n) => <Icon key={n} name={n} size={24} />)}
          </View>
        </Block>
      </ScrollView>
      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Bible language" closeLabel="Close" testID="sheet">
        <SegmentedChoice testID="sheet-seg" selected="te" onSelect={() => {}}
          options={[{ value: 'te', label: 'Telugu' }, { value: 'en', label: 'English' }, { value: 'bi', label: 'Both' }]} />
        <AppButton title="Done" onPress={() => setSheet(false)} fullWidth />
      </Sheet>
      <ConfirmDialog visible={dialog} title="Log out?" message="You will need to sign in again to use your journal and notes."
        cancelLabel="Cancel" confirmLabel="Log out" onCancel={() => setDialog(false)} onConfirm={() => setDialog(false)} testID="dialog" />
    </View>
  );
}

const g = globalThis as any;
g.__mount = () => {
  createRoot(document.getElementById('root')!).render(
    <AuthProvider><PreferencesProvider><Gallery /></PreferencesProvider></AuthProvider>
  );
};
g.__ready = true;
`;

const { html } = await buildQa({ name: 'qa-design-system', entry });
const browser = await launch();
const problems = [];
const hooks = { problems, shots: path.join(OUT, 'qa-shots') };

for (const [name, opts] of [
  ['light', {}],
  ['dark', { dark: true }],
  ['te', { storage: { app_language_preference: 'te' } }],
]) {
  const qa = await openQa(browser, html, `ds-${name}`, DEVICES.PHONE, opts, hooks);
  // the gallery is long: shoot it in 844-point slices
  const height = await qa.eval(() => document.querySelector('[data-testid="gallery"]').scrollHeight);
  let y = 0;
  let i = 0;
  while (y < height) {
    await qa.eval((top) => { document.querySelector('[data-testid="gallery"]').scrollTop = top; }, y);
    await qa.advance(60);
    await qa.shot(`s${String(i).padStart(2, '0')}`);
    y += 700;
    i += 1;
  }
  if (name === 'light') {
    await qa.eval(() => window.__open.sheet());
    await qa.advance(300);
    await qa.shot('sheet');
    await qa.eval(() => window.__open.closeAll());
    await qa.advance(100);
    await qa.eval(() => window.__open.dialog());
    await qa.advance(300);
    await qa.shot('dialog');
  }
  await qa.close();
}
await browser.close();
console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'no console errors or warnings');
