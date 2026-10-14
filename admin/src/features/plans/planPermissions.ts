/**
 * Who may change reading plans.
 *
 * Content administrators and above may create, edit, publish and delete
 * plans; a host may read them (firestore.rules' isContentAdminOrAbove() and
 * isHostOrAbove()). Hiding a button is a courtesy to the person looking at
 * the screen -- the rules are the boundary.
 */
export function canManagePlans(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}
