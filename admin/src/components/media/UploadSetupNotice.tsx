import { Alert, Box, Typography } from '@mui/material';
import {
  describeUnavailable,
  type CloudinaryConfig,
  type UploadKind,
} from '../../services/media/cloudinaryConfig';

/**
 * Shown INSTEAD of an upload button when uploading is not ready.
 *
 * An upload button that cannot work is worse than none: the administrator
 * picks a file, waits, and is told something broke. So when the Cloudinary
 * settings are missing or wrong this says so up front, in two voices: a
 * plain sentence for the person using the site, and -- under "For the
 * person setting it up" -- the exact variable names, for whoever has to
 * fix it. Values are never printed; see ../../services/media/cloudinaryConfig.ts.
 */
export function UploadSetupNotice({
  config,
  kind,
  testId,
}: {
  config: CloudinaryConfig;
  kind: UploadKind;
  testId: string;
}) {
  return (
    <Alert
      severity={config.status === 'invalid' ? 'warning' : 'info'}
      data-testid={testId}
    >
      <Typography variant="body2" component="p">
        {describeUnavailable(config, kind)} You can still choose a file that is already in
        the media library, or paste a web address. To switch uploading on, ask whoever
        manages this website to connect the free Cloudinary account (the steps are in
        docs/admin/MEDIA_UPLOADS.md).
      </Typography>
      {config.status !== 'ready' ? (
        <Box component="details" sx={{ mt: 1 }}>
          <Box component="summary" sx={{ cursor: 'pointer', fontWeight: 600 }}>
            For the person setting it up
          </Box>
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {(config.status === 'missing' ? config.missing : config.problems).map(
              (line) => (
                <li key={line}>
                  <Typography variant="body2" component="span">
                    {config.status === 'missing' ? (
                      <>
                        Missing: <code>{line}</code>
                      </>
                    ) : (
                      line
                    )}
                  </Typography>
                </li>
              )
            )}
          </Box>
        </Box>
      ) : null}
    </Alert>
  );
}
