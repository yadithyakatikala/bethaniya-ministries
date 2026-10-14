import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UploadError,
  describeUploadError,
  uploadToCloudinary,
} from '../../services/media/cloudinaryUpload';
import { validateUploadFile } from '../../services/media/uploadRules';
import type { UploadKind } from '../../services/media/cloudinaryConfig';
import type { MediaCategory, UploadedAsset } from '../../services/media/types';
import { assetFromUpload, createMediaAsset } from '../../services/firebase/mediaAssets';
import { useAuthStore } from '../../store/authStore';
import { describeLibraryError } from './libraryErrors';

export type UploadPhase = 'idle' | 'uploading' | 'error';

export interface UploadState {
  phase: UploadPhase;
  /** 0-100. Held at 99 until Cloudinary has stored the file. */
  percent: number;
  fileName: string | null;
  /** A local picture of the chosen image while it uploads. */
  previewUrl: string | null;
  /** Why the file was refused or the upload failed. */
  error: string | null;
  /** The upload worked but recording it in the library did not. */
  libraryWarning: string | null;
}

const INITIAL: UploadState = {
  phase: 'idle',
  percent: 0,
  fileName: null,
  previewUrl: null,
  error: null,
  libraryWarning: null,
};

export interface UploadResult {
  /** The https address to store. */
  url: string;
  uploaded: UploadedAsset;
  /** The library record's id, or null if it could not be written. */
  libraryId: string | null;
  libraryError: string | null;
}

/**
 * The upload state machine every upload field shares.
 *
 *   choose a file -> check it in the browser -> send it, with progress ->
 *   record it in the library -> hand the address to the form
 *
 * The form receives the address through `onUploaded` the moment Cloudinary
 * has stored the file. Recording it in the library comes second and is
 * allowed to fail without failing the upload: the file is real and the
 * address works, and the form should not lose either because a catalogue
 * write was refused (see ./libraryErrors.ts for the usual reason).
 *
 * Unmounting while an upload runs cancels it; there is nobody left to
 * receive the result, and a stray upload would only use up the account's
 * free allowance.
 */
export function useMediaUpload({
  kind,
  category,
  validateFile,
  details,
  onUploaded,
}: {
  kind: UploadKind;
  category: MediaCategory;
  /** A feature's own check, if it has one; defaults to the shared rules. */
  validateFile?: (file: File) => string | null;
  /**
   * A title and description for the library record, read at the moment
   * the upload finishes. The media library's own dialog supplies them;
   * a form's upload field does not, and the record is titled from the
   * file's name (an administrator can rename it in the library).
   */
  details?: { title?: string; altText?: string };
  onUploaded: (result: UploadResult) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState<UploadState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const lastFileRef = useRef<File | null>(null);
  const previewRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  // The latest callback, kept in a ref so `start` need not change identity
  // (and be re-created) every time the form re-renders with a new closure.
  // Updated in an effect, not during render.
  const onUploadedRef = useRef(onUploaded);
  const detailsRef = useRef(details);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
    detailsRef.current = details;
  });

  const revokePreview = useCallback(() => {
    if (previewRef.current && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(previewRef.current);
    }
    previewRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      revokePreview();
    };
  }, [revokePreview]);

  const start = useCallback(
    async (file: File) => {
      const problem = (validateFile ?? ((f: File) => validateUploadFile(f, kind)))(file);
      if (problem) {
        revokePreview();
        setState({ ...INITIAL, error: problem });
        return;
      }

      lastFileRef.current = file;
      const controller = new AbortController();
      abortRef.current = controller;

      revokePreview();
      const previewUrl =
        kind === 'image' && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(file)
          : null;
      previewRef.current = previewUrl;

      setState({
        phase: 'uploading',
        percent: 0,
        fileName: file.name,
        previewUrl,
        error: null,
        libraryWarning: null,
      });

      try {
        const uploaded = await uploadToCloudinary(file, kind, {
          signal: controller.signal,
          onProgress: (percent) => {
            if (mountedRef.current) setState((s) => ({ ...s, percent }));
          },
        });

        let libraryId: string | null = null;
        let libraryError: string | null = null;
        try {
          libraryId = await createMediaAsset(
            assetFromUpload(uploaded, {
              title: detailsRef.current?.title ?? '',
              altText: detailsRef.current?.altText ?? '',
              category,
            }),
            { uid: user?.uid ?? '', name: user?.displayName || user?.email || '' }
          );
        } catch (error) {
          libraryError = describeLibraryError(error);
        }

        if (!mountedRef.current) return;
        revokePreview();
        setState({ ...INITIAL, libraryWarning: libraryError });
        onUploadedRef.current({ url: uploaded.url, uploaded, libraryId, libraryError });
      } catch (error) {
        if (!mountedRef.current) return;
        if (error instanceof UploadError && error.code === 'aborted') {
          revokePreview();
          setState(INITIAL);
          return;
        }
        setState({
          phase: 'error',
          percent: 0,
          fileName: file.name,
          previewUrl,
          error: describeUploadError(error),
          libraryWarning: null,
        });
      }
    },
    [category, kind, revokePreview, user, validateFile]
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const retry = useCallback(() => {
    if (lastFileRef.current) void start(lastFileRef.current);
  }, [start]);

  const dismiss = useCallback(() => {
    revokePreview();
    setState(INITIAL);
  }, [revokePreview]);

  return { state, start: (file: File) => void start(file), cancel, retry, dismiss };
}
