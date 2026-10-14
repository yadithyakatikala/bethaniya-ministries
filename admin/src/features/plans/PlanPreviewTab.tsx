import { useState } from 'react';
import { Alert, Box, MenuItem, TextField, Typography } from '@mui/material';
import BookOutlined from '@mui/icons-material/BookOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import { adminColors, adminRadii, adminFonts } from '../../theme/tokens';
import { checkPassageList } from '../scripture/passages';
import { languageLabel, type PlanDetailsForm } from './planDetails';
import type { DayDraft } from './planDays';

/**
 * What members will see, laid out the way the app lays it out: the card in
 * the plan library, and one day.
 *
 * Deliberately plain. It checks the administrator's own words and the order
 * of things -- that the description reads well, that a day with no
 * devotional looks right -- rather than being a phone mock-up, so it does
 * not pretend to know the exact fonts and sizes of the app. Nothing here is
 * saved or sent anywhere.
 */
export function PlanPreviewTab({
  details,
  days,
  visibleToMembers,
}: {
  details: PlanDetailsForm;
  days: readonly DayDraft[];
  /** Whether members can read the plan right now. */
  visibleToMembers: boolean;
}) {
  const [dayIndex, setDayIndex] = useState(0);
  const index = Math.min(dayIndex, Math.max(0, days.length - 1));
  const day = days[index] ?? null;
  const reading = day ? checkPassageList(day.passages) : null;
  const paragraphs = (day?.devotional ?? '')
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim().length > 0);

  return (
    <Box data-testid="plan-preview-tab">
      <Alert severity={visibleToMembers ? 'info' : 'warning'} sx={{ mb: 3 }}>
        {visibleToMembers
          ? 'This is how members see the plan now, including any changes you have not saved yet.'
          : 'Members cannot see this plan yet. This is how it will look when it is published.'}
      </Alert>

      <Box
        sx={{
          display: 'grid',
          gap: 4,
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(260px, 340px) minmax(280px, 400px)',
          },
          alignItems: 'start',
        }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            In the plan library
          </Typography>
          <Box
            data-testid="plan-preview-card"
            sx={{
              mt: 1,
              border: `1px solid ${adminColors.border}`,
              borderRadius: `${adminRadii.card}px`,
              overflow: 'hidden',
              bgcolor: adminColors.surface,
            }}
          >
            <Box
              sx={{
                aspectRatio: '16 / 9',
                bgcolor: adminColors.surfaceRaised,
                display: 'grid',
                placeItems: 'center',
                color: adminColors.inkSubtle,
              }}
            >
              {details.coverImageUrl ? (
                <Box
                  component="img"
                  src={details.coverImageUrl}
                  alt=""
                  data-testid="plan-preview-cover"
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <Box sx={{ textAlign: 'center' }} data-testid="plan-preview-no-cover">
                  <ImageOutlined />
                  <Typography variant="caption" component="p">
                    No cover image
                  </Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ p: 2 }}>
              <Typography
                variant="overline"
                sx={{ color: adminColors.accent, display: 'block', lineHeight: 1.6 }}
              >
                {details.category.trim() || 'Category'}
              </Typography>
              <Typography
                data-testid="plan-preview-title"
                sx={{
                  fontFamily: adminFonts.heading,
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  lineHeight: 1.3,
                  overflowWrap: 'anywhere',
                }}
              >
                {details.title.trim() || 'Untitled plan'}
              </Typography>
              {details.subtitle.trim() ? (
                <Typography
                  color="text.secondary"
                  sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
                >
                  {details.subtitle.trim()}
                </Typography>
              ) : null}
              <Typography
                variant="body2"
                sx={{ mt: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                color={details.description.trim() ? 'text.primary' : 'text.disabled'}
              >
                {details.description.trim() || 'The description will appear here.'}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5 }}
              >
                {[
                  `${days.length} ${days.length === 1 ? 'day' : 'days'}`,
                  details.estimatedMinutes.trim()
                    ? `about ${details.estimatedMinutes.trim()} min a day`
                    : null,
                  languageLabel(details.language),
                  details.author.trim() ? `by ${details.author.trim()}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="overline" color="text.secondary">
              A day
            </Typography>
            {days.length > 0 ? (
              <TextField
                select
                size="small"
                label="Day"
                value={index}
                onChange={(event) => setDayIndex(Number(event.target.value))}
                sx={{ minWidth: 120 }}
                slotProps={{ htmlInput: { 'data-testid': 'plan-preview-day-select' } }}
              >
                {days.map((candidate, at) => (
                  <MenuItem key={candidate.key} value={at}>
                    Day {at + 1}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
          </Box>

          <Box
            data-testid="plan-preview-day"
            sx={{
              mt: 1,
              p: 2.5,
              border: `1px solid ${adminColors.border}`,
              borderRadius: `${adminRadii.card}px`,
              bgcolor: adminColors.paper,
            }}
          >
            {!day ? (
              <Typography color="text.secondary" data-testid="plan-preview-no-days">
                Add a day to preview it.
              </Typography>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary">
                  Day {index + 1} of {days.length}
                </Typography>
                <Typography
                  variant="overline"
                  sx={{ color: adminColors.accent, display: 'block', mt: 0.5 }}
                  data-testid="plan-preview-reference"
                >
                  {reading?.stored || 'No reading yet'}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: adminFonts.heading,
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    lineHeight: 1.25,
                    overflowWrap: 'anywhere',
                  }}
                  data-testid="plan-preview-day-title"
                >
                  {day.title.trim() || 'Untitled day'}
                </Typography>

                <Box
                  sx={{
                    mt: 2,
                    py: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    borderTop: `1px solid ${adminColors.border}`,
                    borderBottom: `1px solid ${adminColors.border}`,
                  }}
                >
                  <BookOutlined sx={{ color: adminColors.accent }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>Read</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Opens in the Bible
                    </Typography>
                  </Box>
                </Box>

                {paragraphs.length > 0 ? (
                  <Section label="Reflect" testId="plan-preview-devotional">
                    {paragraphs.map((paragraph, at) => (
                      <Typography key={at} sx={{ mb: 1.5, whiteSpace: 'pre-wrap' }}>
                        {paragraph.trim()}
                      </Typography>
                    ))}
                  </Section>
                ) : null}
                {day.reflectionQuestion.trim() ? (
                  <Section label="Think about it" testId="plan-preview-question">
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                      {day.reflectionQuestion.trim()}
                    </Typography>
                  </Section>
                ) : null}
                {day.application.trim() ? (
                  <Section label="Put it into practice" testId="plan-preview-application">
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                      {day.application.trim()}
                    </Typography>
                  </Section>
                ) : null}
                {day.prayerPrompt.trim() ? (
                  <Section label="Prayer" testId="plan-preview-prayer">
                    <Typography
                      sx={{
                        whiteSpace: 'pre-wrap',
                        pl: 1.5,
                        borderLeft: `2px solid ${adminColors.goldBase}`,
                      }}
                    >
                      {day.prayerPrompt.trim()}
                    </Typography>
                  </Section>
                ) : null}
                {day.notes.trim() ? (
                  <Section label="Notes" testId="plan-preview-notes">
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ whiteSpace: 'pre-wrap' }}
                    >
                      {day.notes.trim()}
                    </Typography>
                  </Section>
                ) : null}
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function Section({
  label,
  testId,
  children,
}: {
  label: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ mt: 2.5 }} data-testid={testId}>
      <Typography
        variant="overline"
        color="text.secondary"
        component="h3"
        sx={{ mb: 0.5, display: 'block' }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}
