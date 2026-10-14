/**
 * The one file check a reading plan has: the cover image.
 *
 * Everything else a plan or a day is checked against lives with the rest of
 * the editor -- ./planDetails.ts (the plan's own fields), ./planDays.ts (a
 * day), ./passages.ts (Scripture references) and ./planReadiness.ts (is it
 * ready to publish) -- whose limits mirror firestore.rules' isValidPlan() and
 * isValidPlanDay().
 */
import { validateUploadFile } from '../../services/media/uploadRules';

/**
 * Whether this file may be uploaded as a plan cover. It is the shared image
 * rule (../../services/media/uploadRules.ts) -- the same formats and
 * 5 MB ceiling for every picture -- so a mistake is caught in the browser
 * before an upload starts. A courtesy only: the limits that really apply
 * are set on the Cloudinary upload preset (docs/admin/MEDIA_UPLOADS.md).
 */
export function validatePlanCoverImage(file: File): string | null {
  return validateUploadFile(file, 'image');
}
