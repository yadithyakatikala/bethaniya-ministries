import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import type { PlanLanguage } from '../../types';
import { BIBLE_STRUCTURE } from '../daily-verses/bibleStructure';
import { parsePassage } from './passages';

/**
 * Choose a passage instead of typing it: a book, a chapter, and optionally
 * a first and last verse. The result is checked by the same parser as typed
 * text, so what the picker offers to add is always a reading that exists
 * and that the app can open.
 *
 * A Telugu plan lists the books by their Telugu names, so the reference it
 * writes keeps them.
 */
export function PassagePicker({
  open,
  language,
  onClose,
  onPick,
  testIdPrefix,
}: {
  open: boolean;
  language: PlanLanguage;
  onClose: () => void;
  /** Receives the passage in its canonical written form. */
  onPick: (passage: string) => void;
  testIdPrefix: string;
}) {
  const [bookId, setBookId] = useState('');
  const [chapter, setChapter] = useState('');
  const [fromVerse, setFromVerse] = useState('');
  const [toVerse, setToVerse] = useState('');

  const book = BIBLE_STRUCTURE.find((entry) => entry.id === bookId);
  const bookName = book ? (language === 'te' ? book.nameTe : book.name) : '';

  const result = useMemo(() => {
    if (!book) return null;
    if (chapter.trim() === '') return null;
    const verses =
      fromVerse.trim() === ''
        ? ''
        : toVerse.trim() === ''
          ? `:${fromVerse.trim()}`
          : `:${fromVerse.trim()}-${toVerse.trim()}`;
    return parsePassage(`${bookName} ${chapter.trim()}${verses}`);
  }, [book, bookName, chapter, fromVerse, toVerse]);

  const chapterCount = book?.verseCounts.length ?? 0;

  function reset() {
    setBookId('');
    setChapter('');
    setFromVerse('');
    setToVerse('');
  }

  function close() {
    reset();
    onClose();
  }

  function add() {
    if (result?.ok) {
      onPick(result.passage.text);
      reset();
    }
  }

  const needsFirstVerse = toVerse.trim() !== '' && fromVerse.trim() === '';

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="xs"
      aria-labelledby={`${testIdPrefix}-title`}
    >
      <DialogTitle id={`${testIdPrefix}-title`}>Choose a passage</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Pick a book and chapter. Add verses to read part of a chapter, or leave them
          empty for the whole chapter.
        </Typography>
        <TextField
          select
          label="Book"
          fullWidth
          margin="normal"
          value={bookId}
          onChange={(event) => {
            setBookId(event.target.value);
            setChapter('');
            setFromVerse('');
            setToVerse('');
          }}
          slotProps={{ htmlInput: { 'data-testid': `${testIdPrefix}-book` } }}
        >
          {BIBLE_STRUCTURE.map((entry) => (
            <MenuItem key={entry.id} value={entry.id}>
              {language === 'te' ? entry.nameTe : entry.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Chapter"
          type="number"
          fullWidth
          margin="normal"
          disabled={!book}
          value={chapter}
          onChange={(event) => setChapter(event.target.value)}
          helperText={
            book
              ? `${bookName} has ${chapterCount} chapter${chapterCount === 1 ? '' : 's'}.`
              : ' '
          }
          slotProps={{
            htmlInput: {
              min: 1,
              max: chapterCount || undefined,
              'data-testid': `${testIdPrefix}-chapter`,
            },
          }}
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="From verse"
            type="number"
            fullWidth
            margin="normal"
            disabled={!book || chapter.trim() === ''}
            value={fromVerse}
            onChange={(event) => setFromVerse(event.target.value)}
            slotProps={{ htmlInput: { min: 1, 'data-testid': `${testIdPrefix}-from` } }}
          />
          <TextField
            label="To verse"
            type="number"
            fullWidth
            margin="normal"
            disabled={!book || chapter.trim() === '' || fromVerse.trim() === ''}
            value={toVerse}
            onChange={(event) => setToVerse(event.target.value)}
            slotProps={{ htmlInput: { min: 1, 'data-testid': `${testIdPrefix}-to` } }}
          />
        </Box>

        <Box
          role="status"
          aria-live="polite"
          data-testid={`${testIdPrefix}-result`}
          sx={{ minHeight: 48, mt: 1 }}
        >
          {needsFirstVerse ? (
            <Typography color="error" variant="body2">
              Enter the first verse too.
            </Typography>
          ) : result?.ok ? (
            <Typography variant="body2">
              <strong>{result.passage.text}</strong> · {result.passage.verseCount}{' '}
              {result.passage.verseCount === 1 ? 'verse' : 'verses'}
            </Typography>
          ) : result ? (
            <Typography color="error" variant="body2">
              {result.message}
            </Typography>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} data-testid={`${testIdPrefix}-cancel`}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!result?.ok || needsFirstVerse}
          onClick={add}
          data-testid={`${testIdPrefix}-add`}
        >
          Add passage
        </Button>
      </DialogActions>
    </Dialog>
  );
}
