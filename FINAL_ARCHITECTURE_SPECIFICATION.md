# BETHANIYA MINISTRIES — FINAL ARCHITECTURE SPECIFICATION

**Status:** Pre-implementation, Baseline Approved

**Corrected per:** 10 clarifications (Bible requirement, authentication, Redux, backups, launch gate, scope)

---

# A. FINAL ARCHITECTURE

## Approved Baseline Stack

### Mobile App (iOS + Android)
- **Framework:** Expo + React Native
- **Language:** TypeScript (strict mode)
- **State Management:** React Context + local state + data-fetching layer (NOT Redux unless justified below)
- **Navigation:** React Navigation
- **UI Components:** React Native built-ins + custom components
- **Local Storage:** AsyncStorage (encrypted session tokens, user preferences)
- **Backend SDK:** Firebase SDK (native bindings)
- **Testing:** Jest + React Native Testing Library

### Admin Web Dashboard
- **Framework:** React 18+
- **Build Tool:** Vite
- **Language:** TypeScript (strict mode)
- **UI Library:** Material-UI v5
- **State Management:** React Context or Zustand (lightweight, not Redux)
- **HTTP/Backend:** Firebase SDK (not separate HTTP client)
- **Hosting:** Vercel or Firebase Hosting
- **Testing:** Vitest + React Testing Library

### Backend
- **Database:** Firebase Firestore (NoSQL)
- **Authentication:** Firebase Auth (email/password for admin, OAuth/phone for members)
- **Serverless:** Cloud Functions (Node.js)
- **Notifications:** Firebase Cloud Messaging (FCM)
- **File Storage:** Firebase Storage (images only)
- **Monitoring:** Firebase Console + Cloud Logging

### External Services
- **Bible Data:** Licensed source (details in Section C)
- **Video Hosting:** YouTube only (no custom streaming)
- **Maps:** Apple Maps / Google Maps (native links, not embedded)

### Security Model
- **Authentication:** Delegated to Firebase Auth
- **Authorization:** Firestore security rules enforce RBAC at database level
- **Secrets:** Environment variables (.env files, not in code)
- **Audit Logging:** Cloud Functions write-only audit collection
- **Backup:** Firestore automated backups (detailed in Section D)

### Infrastructure Philosophy
- **Zero DevOps:** All services Google-managed
- **Scaling:** Automatic (no capacity planning)
- **Disaster Recovery:** Automated backups (not relying on version history alone)
- **Handoff:** Professional, documented, portable to any development team

---

## Why Redux was NOT chosen for state management

**Redux Evaluation:**

Redux is a powerful state management tool, but introduces complexity:
- Additional boilerplate (actions, reducers, selectors)
- Serialization constraints (all state must be serializable)
- Debugging overhead (middleware, dev tools)
- Learning curve for new developers

**For this app's actual state:**

Mobile app state categories:
1. **Server state (from Firestore):** Handled by real-time listeners, not Redux
2. **UI state (loading, errors):** Small + localized (use Context or local component state)
3. **User preferences (language, theme):** AsyncStorage + Context
4. **Session (auth token):** AsyncStorage + Context

**Conclusion:** React Context + AsyncStorage is sufficient. Redux added complexity without commensurate benefit.

**If Redux becomes necessary later:** Easy to add in V2 if state complexity grows beyond Context's capability.

---

# B. FINAL V1 SCOPE

## P0 — MUST SHIP (Non-negotiable for V1)

### Member Mobile App
1. **Authentication**
   - Sign in options: Google OAuth, Apple Sign-in (iOS), Phone OTP
   - Session persistence across restarts
   - Logout functionality
   - No account creation friction (OAuth/OTP only)

2. **Home Screen**
   - Church branding (logo, name, description)
   - Daily verse card (today's verse + image)
   - Announcements list (title + preview, scrollable)
   - Tap announcement → full detail page
   - Pull-to-refresh to reload content
   - Loading state (spinner), error state (retry button), empty state (no announcements)

3. **Bible Module — EXACTLY 2 LANGUAGES**
   - **English:** Legal, licensed translation confirmed
   - **Telugu:** Legal, licensed translation confirmed
   - Navigation: Books → Chapters → Verses
   - Verse display: Text + reference + chapter navigation (prev/next)
   - Language toggle (persists in profile)
   - Offline: Previously loaded chapters cached locally
   - Dark mode: Readable in light and dark themes

4. **Events**
   - List upcoming events (date-sorted)
   - Event detail: title, date/time, location, description
   - Map link (opens native Maps app)
   - "WATCH LIVE" button (if event marked LIVE in admin)
   - YouTube embedded player (if LIVE)

5. **Songs**
   - Song list (all published songs)
   - Song detail: title, artist, lyrics (plain text)
   - Audio player (play/pause/restart, if audio URL exists)
   - Favorites button (local storage, optional cloud sync)

6. **Profile + Settings**
   - View profile: name, email, phone
   - Edit profile: change name + photo
   - Language preference: English / Telugu (sync to Firestore)
   - Theme preference: Light / Dark (sync to Firestore)
   - Notifications toggle: on/off
   - Logout button
   - Privacy policy + terms (links)

7. **Notifications (Push)**
   - Receive FCM notifications from admin
   - Notification Center (in-app list of recent)
   - Tap notification → navigate to relevant screen (announcement, event, live)
   - Dismissable notifications
   - User can toggle notifications on/off

### Admin Web Dashboard
8. **Authentication**
   - Email + password login
   - Password reset via email
   - Session persistence
   - Protected routes (require login)

9. **Dashboard Overview**
   - Quick stats (member count, recent actions)
   - Recent activity feed
   - Quick action buttons (New Announcement, New Event, Send Notification)

10. **Content Management — Announcements**
    - List all announcements (publish status visible)
    - Create announcement: title + content + image upload
    - Edit announcement: modify any field
    - Delete announcement: with confirmation
    - Publish/unpublish toggle (controls visibility to members)
    - Image upload to Firebase Storage

11. **Content Management — Daily Verse**
    - Form: scripture reference selector + verse text (auto-filled) + image upload + date
    - Save daily verse (applies to mobile app on that date)
    - Bulk import future verses (optional, V2)

12. **Content Management — Songs**
    - List songs (publish status visible)
    - Create song: title, artist, category, lyrics, audio URL, cover URL
    - Edit/delete song with confirmation
    - Publish/unpublish toggle

13. **Content Management — Events**
    - List events (publish status visible)
    - Create event: title, date/time, location, description
    - Edit/delete event with confirmation
    - Publish/unpublish toggle
    - For live events: YouTube URL input + validation
    - "LIVE NOW" toggle (immediately shows on mobile)

14. **Live Stream Manager**
    - Set YouTube Live URL
    - Toggle "LIVE NOW" (appears on mobile as WATCH LIVE)
    - End live stream button (hides from mobile)

15. **Notifications**
    - Compose notification: title + message + optional image
    - Recipient selector: All Members / Admins Only
    - Send button + confirmation
    - Notification log (view past sent)

16. **Users + Roles (Admin-level)**
    - View all users (name, email, phone, role, join date)
    - Change user role: Super Admin / Content Admin / Host / Member (Super Admin only)
    - Roles enforced by Firestore security rules (not just UI)

17. **Settings**
    - Church name, logo URL, description
    - Support email
    - Save button (syncs to mobile app display)

### Core Enablers
18. **RBAC (Role-Based Access Control)**
    - 4 roles: Super Admin, Content Admin, Host, Member
    - Enforced by Firestore security rules
    - Admin UI shows only actions user can perform
    - Audit trail of all admin actions

19. **Security Hardening**
    - No secrets in code (.env.local + Firebase)
    - HTTPS enforced
    - Input validation on all forms
    - Audit logging for all admin actions
    - Authentication + authorization enforced server-side

---

## P1 — SHIP ONLY IF TIME + QUALITY PERMITS (Cut First If Slipping)

**Time Budget:** ~12-15 additional hours. If schedule slips, these are removed in this order:

1. **Bible Search** (2-3 hours)
   - Full-text search across loaded chapters
   - Returns matching verses
   - Cut if: Bible loading takes longer, or search has bugs

2. **Bible Copy/Share** (1-2 hours)
   - Copy verse to clipboard
   - Share to social media / messaging
   - Cut if: Need more time on core features

3. **Dark Mode Implementation** (2-3 hours)
   - Complete light/dark theme
   - Applies to all screens
   - Cut if: Core screens have bigger issues

4. **Admin Settings Page** (1 hour)
   - Church name + logo UI (not just settings in database)
   - Cut if: Admin dashboard core features need polish

5. **Text Size Adjustment** (1-2 hours)
   - Adjust Bible verse text (3 sizes: small, normal, large)
   - Cut if: Bible rendering more complex than expected

6. **Notification Log UI** (1 hour)
   - Admin sees past notifications sent
   - Cut if: Core notifications work but log is lower priority

---

## V2 — DEFINITELY AFTER V1 (Weeks 4-12+)

**Not part of V1 launch. Do not attempt in 21 days:**

- ❌ **Donations/Payments** (Razorpay integration, Week 13-14, complex)
- ❌ **Bible Bookmarks** (Star verses, local + sync, 3 hours but deferred)
- ❌ **Event Reminders** (Notify before event, requires scheduling, Week 3-4)
- ❌ **Bible Audio** (Text-to-speech or recorded narration, Week 10-12)
- ❌ **More Languages** (Hindi, Kannada, Tamil, 1-2 weeks each)
- ❌ **Member Directory** (Search users, Week 11-12)
- ❌ **Prayer Requests** (User-submitted, moderation, Week 11-12)
- ❌ **Community Features** (Groups, messaging, Week 13+)
- ❌ **Advanced Admin** (Bulk import, analytics, Week 12+)
- ❌ **Account Deletion** (User request to delete account, Week 11-12)

---

## Cut List Priority (If Day 21 Approaching)

**If Day 20 arrives and something must be cut:**

1. First cut: P1 #6 (Notification Log) — 1 hour saved, lowest impact
2. Second cut: P1 #4 (Admin Settings page) — 1 hour saved
3. Third cut: P1 #5 (Text size) — 2 hours saved
4. Fourth cut: P1 #3 (Dark mode) — 3 hours saved (but impacts UX)
5. Fifth cut: P1 #2 (Copy/share) — 2 hours saved
6. Sixth cut: P1 #1 (Bible search) — 3 hours saved (but impacts usability)

**Core P0 features NEVER cut.** If P0 is incomplete on Day 21, app does not launch.

---

# C. BIBLE LICENSING STATUS

## Current State: NOT APPROVED FOR IMPLEMENTATION

**Rule:** Do not use copyrighted Bible content without verified, written licensing agreement.

---

## English Bible

### Requirement
- Legal, licensed translation
- Allows: offline caching, search, copy to clipboard, share, App Store distribution
- Church/non-profit use

### Options Evaluated

**Option 1: API.Bible (Digital Bible Society)**
- Status: ❓ NOT VERIFIED
- Translations available: ESV, NIV, NKJV, KJV, etc.
- What we need: Written license agreement for mobile app use (cache, search, share, App Store distribution)
- Timeline: Contact today, expect response 48 hours
- Cost: Likely $0-50/month for V1 scale
- Risk: License terms might restrict search or offline caching
- Fallback: If API.Bible license is restrictive, use Option 2

**Option 2: Open-Source Bible (Formatted Bible API / Open Bible Project)**
- Status: ❓ PARTIALLY AVAILABLE
- Available: Public domain or permissive license (MIT/GPL)
- What we need: Confirm which translations are available, verify licensing terms
- Timeline: Research 4-8 hours, confirm by Day 2
- Cost: $0
- Risk: Limited translation options
- Advantage: No licensing negotiation needed

**Option 3: Hardcoded Sample Data**
- Status: ✅ USABLE FOR TESTING
- Purpose: Development + testing only
- Data: 100-200 sample verses from public domain or placeholder
- When: If neither Option 1 nor Option 2 is confirmed by Day 5
- Clear marking: "Development version — real Bible coming soon"
- Timeline: Deploy by Day 5 if needed

### Decision Required FROM YOU
```
Before Day 1, choose:
[ ] A) Start contacting API.Bible today for license agreement
[ ] B) Start researching open-source Bible sources today
[ ] C) Use hardcoded sample data for testing, finalize licensing later
[ ] D) Other: _________
```

### What We CAN Proceed Without English Bible
- ✅ Home screen (daily verse image can be generic)
- ✅ Admin dashboard
- ✅ Authentication
- ✅ Songs, events, announcements
- ✅ Notifications
- ✅ All admin functions

### What IS BLOCKED Without English Bible
- ❌ Bible screen (no content to display)
- ❌ Bible search (no searchable content)

---

## Telugu Bible

### Requirement
- Legal, licensed translation
- Allows: offline caching, search, copy to clipboard, share, App Store distribution
- Church/non-profit use
- **MANDATORY for V1** (original requirement: Telugu + English exactly)

### Options Evaluated

**Option 1: Bible Society of India (Licensed)**
- Status: ❓ NOT VERIFIED
- Source: BSI Telugu Bible translation (widely used)
- What we need: Written license agreement for mobile app redistribution
- Timeline: Contact today, expect 3-7 business days
- Cost: Likely requires donation or paid license
- Risk: Licensing response time may delay Day 1
- Advantage: Highest quality, official translation

**Option 2: Open-Source Telugu Bible (GitHub)**
- Status: ❓ NOT IDENTIFIED YET
- Search: "Telugu Bible GitHub" + "open source Telugu Bible"
- What we need: Verify license (MIT, GPL, CC, public domain)
- Timeline: Research 4-8 hours, confirm by Day 2
- Cost: $0
- Risk: May not be complete (partial books only)
- Advantage: No licensing negotiation

**Option 3: Placeholder Data Only**
- Status: ✅ USABLE FOR TESTING
- Purpose: Development + testing only
- Data: 50-100 synthetic Telugu verses (clearly fake)
- When: If neither Option 1 nor 2 is confirmed by Day 3
- Clear marking: "Development version — real Telugu Bible coming soon"
- Timeline: Deploy by Day 3 if needed
- Impact: Violates original V1 requirement ("exactly Telugu + English")
- Recovery: Add real Telugu Bible in V2 (1-2 weeks)

### Decision Required FROM YOU
```
Before Day 1, choose:
[ ] A) Start contacting Bible Society of India today for license
[ ] B) Start researching open-source Telugu Bible sources today
[ ] C) Use placeholder data for testing, add real Telugu Bible in V2
[ ] D) Other: _________

Note: If neither A nor B succeeds by Day 3, we default to C 
(placeholder for testing, real Telugu in V2).
```

---

## Blocked / Proceeding Without Bible

### What IS BLOCKED (Cannot implement without licensed Bible)
- ❌ Bible reading (core feature)
- ❌ Bible search (core feature)
- ❌ Copy/share verses (P1 feature)

### What CAN PROCEED Without Bible Licensing Resolved
- ✅ Mobile app architecture + auth + navigation
- ✅ Admin dashboard (full feature set)
- ✅ Announcements, songs, events, daily verse (all functional)
- ✅ Push notifications
- ✅ RBAC + security
- ✅ Integration with Firebase

### Timeline Impact If Bible Licensing Delayed

| Day | Scenario | Impact |
|-----|----------|--------|
| **Day 1-3** | Licensing research in flight | No impact, other dev proceeds |
| **Day 3** | License confirmed | Implement Bible immediately |
| **Day 3** | License NOT confirmed | Use placeholder, mark as V2 |
| **Day 5** | Still unresolved | Deploy with placeholder Bible + clear messaging |
| **Day 21** | Still unresolved | Ship V1 without Bible (app fully functional otherwise) |

### DO NOT
- ❌ Assume "non-profit" automatically grants redistribution rights
- ❌ Hardcode copyrighted Bible without license (legal risk)
- ❌ Use "small excerpts = fair use" reasoning (not applicable to full Bible)
- ❌ Copy Bible from online sources without verifying redistribution rights

---

# D. SECURITY STATUS

## Authentication

### Member Authentication
- **Methods:** Google OAuth, Apple Sign-in (iOS), Phone OTP
- **Implementation:** Firebase Auth (handles all cryptography)
- **Risk:** None (Firebase is SOC 2 Type II certified)
- **Not included:** Email/password for members (OAuth/OTP only, simpler UX)

### Admin Authentication
- **Method:** Email + password only
- **Implementation:** Firebase Auth
- **Password Reset:** Email link (Firebase handles)
- **Risk:** None (Firebase Auth standard security)
- **Not included:** 2FA (add in V2 if needed)

### Session Management
- **Mobile:** Firebase token + AsyncStorage (encrypted by OS)
- **Admin:** Firebase session (browser storage)
- **Logout:** Clears session immediately
- **Persistence:** Session persists across app restart (intentional)

### Verdict: ✅ SECURE

---

## Authorization (RBAC)

### 4 Roles
1. **Super Admin** — Full access (manage users, roles, settings, audit log)
2. **Content Admin** — Manage announcements, songs, events, daily verse, live stream, notifications
3. **Host** — Manage live stream + send notifications (limited content mgmt)
4. **Member** — Read-only access to published content

### Enforcement
- **Server-side:** Firestore security rules prevent unauthorized writes
- **Client-side:** Admin UI hides disallowed actions (UX only, not security)
- **Audit:** All admin actions logged (immutable, Cloud Functions write-only)
- **Risk:** If Super Admin account compromised, attacker has full access (mitigated by password policy + audit logs)

### Database Access Control

| Collection | Member | Host | Content Admin | Super Admin |
|---|---|---|---|---|
| `users` | Read own only | Read own | Read all | Read all + write |
| `announcements` | Read published | Read all | Read all + write | Read all + write |
| `daily_verses` | Read | Read | Read + write | Read + write |
| `songs` | Read published | Read all | Read all + write | Read all + write |
| `events` | Read published | Read all | Read all + write | Read all + write |
| `notifications_log` | None | Read | Read | Read |
| `audit_log` | None | None | None | Read |
| `settings` | Read | Read | Read | Read + write |

### Verdict: ✅ SECURE

---

## Database Rules (Firestore Security Rules)

**Deployment:** Day 2 (before any code writes to database)

**Strategy:** Whitelist-only (deny by default, allow specific cases)

**Key Rules:**
- Members cannot read unpublished content
- Members cannot write to any collection
- Admins cannot elevate their own privileges (role changes only via Super Admin)
- Audit log cannot be modified by anyone (Cloud Functions only)
- Notifications log cannot be modified by anyone (Cloud Functions only)

**Testing:** Each rule tested on Day 2 (authorized vs unauthorized access)

### Verdict: ✅ SECURE

---

## Backup & Disaster Recovery

### What is Backed Up
- ✅ Firestore database (all collections)
- ✅ Firebase Storage (all images)
- ✅ Firebase Auth (user accounts)
- ❌ Cloud Functions code (stored in source control, not data backup)

### Backup Frequency
- **Automatic:** Daily (Google-managed)
- **Retention:** 7-35 days (configurable, recommend 30 days)
- **Encryption:** At rest (Google-managed)

### Recovery Procedure
1. Contact Google Cloud Support (Firebase doesn't expose restore UI)
2. Specify: Date of backup to restore
3. Google performs: Full database restore (affects production)
4. Timeline: 24-48 hours
5. Who can request: Super Admin (documented in runbook)

### Testing Recovery
- **V2 only:** Schedule quarterly test restore to staging environment
- **V1:** Document procedure, do not test during launch

### Alternative: Export + Backup Script
- **Cloud Functions:** Scheduled function exports Firestore to Cloud Storage daily
- **Timeline:** Add in V1 Day 19 if time permits
- **Benefit:** Faster recovery if Google is unavailable

### Verdict: ✅ ACCEPTABLE for V1 (standard Google backup sufficient)

---

## Audit Logging

### What is Logged
- Admin login (timestamp, email)
- Content creation (announcement, song, event, daily verse)
- Content modifications (edit, publish, unpublish, delete)
- Role changes (user role assignment)
- Settings changes (church info)

### How it Works
- **Trigger:** Cloud Function on each admin action
- **Storage:** Immutable `audit_log` collection
- **Access:** Super Admin only (read-only)
- **Retention:** Forever (Firestore stores indefinitely)

### Audit Log Entry Format
```
{
  timestamp: <server timestamp>,
  admin_id: <user UID>,
  admin_email: <email for readability>,
  action: "create" | "update" | "delete" | "publish" | "unpublish",
  collection: "announcements" | "events" | "songs" | etc,
  document_id: <ID of modified content>,
  change_summary: "Published announcement 'Sunday Sermon'",
  details: { old_data, new_data } // Optional, for delete
}
```

### Verdict: ✅ SUFFICIENT FOR V1

---

## Secrets Management

### Environment Variables (.env.local)
**Used for:** Local development only (gitignored)
```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
... (Firebase config values)
```

### .env.example
**Committed to Git:** Template with placeholder values (no real secrets)
```
EXPO_PUBLIC_FIREBASE_API_KEY=YOUR_KEY_HERE
...
```

### Production Secrets
- **Firebase credentials:** Embedded in native build (App ID, API keys are public)
- **Cloud Functions secrets:** Firebase Secret Manager (not in code)
- **Database access:** Firebase security rules enforce (not an API key)

### Verdict: ✅ CORRECT

---

## Input Validation

### Client-Side (Mobile + Admin)
- ✅ Trim whitespace
- ✅ Check required fields
- ✅ Validate email format
- ✅ Validate URL format (for YouTube, audio URLs)
- ✅ Validate image size (< 5 MB)

### Server-Side (Cloud Functions)
- ✅ Re-validate all inputs (do not trust client)
- ✅ Sanitize HTML (prevent XSS, though app is mostly plain text)
- ✅ Check authorization (role-based)
- ✅ Prevent injection attacks (Firestore is safe, but validate structure)

### Verdict: ✅ SUFFICIENT

---

## Summary: Security Status

| Area | Status | Notes |
|------|--------|-------|
| Authentication | ✅ Secure | Firebase Auth handles |
| Authorization (RBAC) | ✅ Secure | Firestore rules enforced |
| Secrets | ✅ Correct | No hardcoded credentials |
| Database Rules | ✅ Deployed Day 2 | Tested before launch |
| Backup/Recovery | ✅ Acceptable | Google-managed, documented |
| Audit Logging | ✅ Sufficient | Immutable, Super Admin access |
| Input Validation | ✅ Correct | Client + server |

**No security blockers identified.** Ready for Day 1.

---

# E. FINAL 21-DAY PLAN

## Timeline Philosophy

**Quality Gate:** V1 launches when Definition of Done is satisfied, not when Day 21 calendar arrives.

**Target:** 2-3 weeks for P0 + essential P1 features

**Fallback:** If Day 20 approaches and P0 is not complete, shift Day 21 and ship when ready (quality first)

**Parallel Work:** Mobile + admin development simultaneous to compress timeline

---

## Week 1: Backend Foundation + Admin Core

### Day 1: Firebase Setup + Project Initialization

**Goals:**
- Firebase project created (dev + staging projects)
- Firestore collections defined
- Security rules deployed (empty database)
- GitHub repo initialized
- Local development environment working

**Work:**
- Create Firebase projects (2 projects: dev + staging)
- Initialize Expo project (mobile app scaffold)
- Initialize Vite + React project (admin dashboard scaffold)
- Setup TypeScript configuration for both
- Create .env.local + .env.example templates
- Initialize GitHub repo, add .gitignore
- Firestore collections created (empty):
  - `users`, `announcements`, `daily_verses`, `songs`, `events`, `notifications_log`, `audit_log`, `settings`
- Security rules deployed (all deny, will enable gradually)
- Firebase Auth configured (enable Google, Apple, phone providers)

**Testing:**
- `npm run dev` works locally (mobile simulator + admin dev server)
- Firebase Emulator runs (for local testing)
- Can read/write test data to Firestore Emulator

**Done When:**
- Both apps build without errors
- Firebase Emulator functioning
- GitHub repo ready
- No hardcoded credentials anywhere

**Estimated Time:** 4-5 hours (Firebase config, project setup, build system)

**Yadithya Input Needed:**
- Google account for Firebase projects
- Confirm dev environment machine ready

---

### Day 2: Authentication System (Mobile + Admin)

**Goals:**
- Members can sign in (Google, Apple, Phone OTP)
- Admin can sign in (email + password)
- Session persists + logout works

**Work:**
- Mobile: Auth screens (Google, Apple, Phone OTP buttons)
- Mobile: Redux/Context for auth state + token storage
- Mobile: Protect screens (if not authenticated, show auth screen)
- Admin: Login page (email input + password input + submit button)
- Admin: Protected routes (if not logged in, redirect to login)
- Firebase Auth: Enable all sign-in methods
- Cloud Functions: `createUserProfile()` on first sign-in (create user doc in Firestore)

**Testing:**
- Google sign-in works (open Google OAuth, redirect back, token stored)
- Apple sign-in works on iOS simulator/device
- Phone OTP works (SMS sent, code verified)
- Session persists after app restart
- Logout clears session
- Admin login works
- Unathenticated users cannot access app

**Done When:**
- All 4 auth methods functional
- No crashes on auth flow
- Session management working

**Estimated Time:** 5-6 hours (auth UI + Firebase integration + session handling)

**Yadithya Input Needed:**
- Test phone number (for OTP testing)
- Google account (for Google OAuth testing)
- Apple account (for Apple Sign-in testing)

---

### Day 3: Firestore Security Rules + Database Design

**Goals:**
- Security rules define RBAC
- Rules tested (authorized vs unauthorized access)
- All collections available for writing

**Work:**
- Write complete Firestore security rules (all 9 collections)
- Test each rule: Can Super Admin write? Can member read published? Can member write? Can host change is_live?
- Deploy security rules to Firebase
- Cloud Functions: `logAdminAction()` triggers on writes (audit logging)
- Create indexes for common queries (published, date_sort, etc.)

**Testing:**
- Super Admin can do everything ✅
- Content Admin can manage content ✅
- Host can manage live stream ✅
- Member cannot write ✅
- Member cannot read unpublished ✅
- Audit log created for each admin action ✅

**Done When:**
- All security rules tested
- No false negatives (legitimate access works)
- No false positives (unauthorized access blocked)
- Audit logging functional

**Estimated Time:** 4-5 hours (rule writing, testing, index creation)

**Yadithya Input Needed:**
- None (standard DevOps)

---

### Day 4: Admin Dashboard — Announcements CRUD + Forms

**Goals:**
- Admin can create/read/update/delete announcements
- Mobile app receives updates in real-time
- Admin can upload images

**Work:**
- Admin: Announcements list page (table showing all announcements + publish status)
- Admin: New announcement form (title + content textarea + image upload)
- Admin: Edit announcement (modify any field)
- Admin: Delete announcement (confirmation dialog)
- Admin: Publish/unpublish toggle
- Firebase Storage: Configure image upload endpoint
- Cloud Functions: Validate announcement input
- Mobile: Real-time listener on announcements collection (updates home screen instantly)

**Testing:**
- Create announcement in admin → appears in mobile app within 1 second
- Edit announcement → change reflected on mobile immediately
- Delete announcement → removed from mobile
- Image uploads to Firebase Storage
- Unpublish announcement → no longer visible on mobile
- Publish announcement → visible on mobile

**Done When:**
- Admin can perform all CRUD operations
- Mobile receives updates in real-time
- No errors on publish/unpublish
- Images display correctly

**Estimated Time:** 5-6 hours (form UI, Firebase writes, real-time listeners)

**Yadithya Input Needed:**
- Test announcement content

---

### Day 5: Daily Verse Management + Home Screen

**Goals:**
- Admin can create/edit daily verses
- Mobile home screen displays daily verse with image
- Daily verse image loads correctly

**Work:**
- Admin: Daily verse form (scripture reference + image upload + date selector)
- Admin: Auto-fill verse text (if Bible source available, else placeholder)
- Mobile: Home screen UI (church branding + daily verse card + announcements list)
- Mobile: Real-time listener on daily_verses collection
- Firebase Storage: Image serving (CDN included)

**Testing:**
- Admin creates daily verse → mobile home screen updates
- Image loads within 2 seconds
- Previous/future verses display correctly
- Verse text renders in dark/light mode
- Empty state displays if no verses

**Done When:**
- Home screen displays correctly
- Daily verse card shows image + text
- Announcements list shows below
- No layout issues on different screen sizes

**Estimated Time:** 4-5 hours (home screen layout, real-time data)

**Yadithya Input Needed:**
- Test daily verse images (3-5 sample images, 16:9 aspect)

---

### Day 6: Songs CRUD + Audio Player

**Goals:**
- Admin can create/edit/delete songs
- Mobile app displays songs with audio player
- Audio plays correctly

**Work:**
- Admin: Songs list page
- Admin: Create/edit song form (title, artist, category, lyrics, audio URL, cover URL)
- Admin: Delete song (confirmation)
- Admin: Publish/unpublish
- Mobile: Songs list screen
- Mobile: Song detail (title, artist, lyrics)
- Mobile: Audio player (play/pause/restart, duration display)
- Mobile: Favorites button (local storage, optional cloud sync in V2)

**Testing:**
- Create song in admin → appears on mobile
- Audio URL plays correctly
- Favorite button toggles
- Favorites persist after restart
- No crashes during playback

**Done When:**
- Songs list functional on mobile
- Audio player works
- Favorites persist

**Estimated Time:** 4-5 hours (forms, audio player, UI)

**Yadithya Input Needed:**
- Sample songs (5 test songs with audio URLs: YouTube/Spotify/etc)

---

### Day 7: Events CRUD + Live Stream Manager

**Goals:**
- Admin can create/edit/delete events
- Mobile app displays events
- Admin can toggle "LIVE NOW"
- Mobile shows "WATCH LIVE" when LIVE

**Work:**
- Admin: Events list page
- Admin: Create/edit event form (title, date/time, location, description)
- Admin: Publish/unpublish
- Admin: Live stream manager (YouTube URL input + "LIVE NOW" toggle)
- Mobile: Events list screen (upcoming events, date-sorted)
- Mobile: Event detail (all info + map link + "WATCH LIVE" button if LIVE)
- Mobile: YouTube embedded player (if "WATCH LIVE" tapped)

**Testing:**
- Create event in admin → appears on mobile
- Set YouTube URL + toggle "LIVE NOW" → "WATCH LIVE" button appears on mobile within 1 second
- Tap "WATCH LIVE" → YouTube opens
- Untoggle "LIVE NOW" → button disappears from mobile
- No crashes

**Done When:**
- Events functional end-to-end
- Real-time LIVE toggle working
- YouTube player functional

**Estimated Time:** 4-5 hours (event forms, live stream, YouTube integration)

**Yadithya Input Needed:**
- Sample events (3-5 events, if some with YouTube URLs for testing)

---

## Week 1 Summary

**By End of Week 1:**
- ✅ Firebase foundation solid
- ✅ Authentication complete (all methods)
- ✅ Security rules deployed + tested
- ✅ Mobile home screen functional (daily verse + announcements)
- ✅ Mobile songs + events functional
- ✅ Admin dashboard core (announcements, daily verse, songs, events CRUD)
- ✅ Real-time sync verified (admin changes appear on mobile instantly)

**Status:** Backend solid, basic mobile + admin working. Ready for Week 2.

**Total Hours:** ~32-35 hours

---

## Week 2: Mobile Expansion + Admin Completion + Testing

### Day 8: Bible Module Setup + Testing Devices

**Goals:**
- Bible module initialized (books, chapters, verses structure)
- Real device builds created (iOS + Android)
- Begin testing on real devices

**Work:**
- Mobile: Bible books list screen
- Mobile: Navigate books → chapters → verses
- Mobile: Verse display (text, reference, previous/next buttons)
- Mobile: Language toggle (English/Telugu)
- Mobile: Dark mode works on Bible screens
- **IF Bible source verified:** Populate with real verses
- **IF Bible source NOT verified:** Use 100-200 placeholder verses + clear labeling
- EAS Build: Configure iOS build (via Expo)
- EAS Build: Configure Android build (via Expo)
- GitHub Actions: Optional CI for builds

**Testing:**
- Bible navigation smooth (no lag)
- Books display correctly
- Verses load quickly
- Dark mode readable
- Build deploys to TestFlight (iOS) + Play Store internal (Android)

**Done When:**
- Bible module structure complete
- Real device builds functional
- Testing can begin on physical iPhone + Android

**Estimated Time:** 5-6 hours (Bible structure, EAS setup, builds)

**Yadithya Input Needed:**
- Confirm iPhone + Android devices ready for testing
- Confirm Apple Developer + Google Play accounts set up

---

### Day 9: Bible Search + Profile Screens

**Goals:**
- Members can search Bible verses
- Profile screen complete (edit, settings, logout)
- Both languages work

**Work:**
- Mobile: Bible search screen (search input + results list)
- Mobile: Full-text search (across locally loaded verses)
- Mobile: Search results highlight matching text
- Mobile: Profile screen (name, email, phone display + edit form)
- Mobile: Settings panel (language toggle, theme toggle, notifications toggle)
- Mobile: Logout button

**Testing:**
- Search finds verses correctly
- Language toggle switches Bible language
- Theme toggle affects all screens
- Profile edits save to Firestore
- Settings persist after restart

**Done When:**
- Bible search functional
- Profile fully editable
- Settings persisted

**Estimated Time:** 4-5 hours (search UI, profile, settings)

**Yadithya Input Needed:**
- Test profile changes

---

### Day 10: Notifications (FCM) Complete

**Goals:**
- Mobile receives push notifications
- Admin can send notifications to members
- Notification center displays history
- Tapping notification navigates correctly

**Work:**
- Mobile: FCM setup (request notification permission)
- Mobile: Foreground notification handler (display while app open)
- Mobile: Background notification handler (display when app closed)
- Mobile: Notification center screen (list of recent notifications)
- Mobile: Notification tap handler (navigate to announcement/event/live)
- Admin: Notifications page (compose title + message + image + recipient selector)
- Admin: Send button (confirmation dialog: "Send to X members?")
- Cloud Functions: `sendNotification()` triggers on admin send (FCM delivery)

**Testing:**
- Admin sends notification → appears on member phones within 5 seconds
- Tap notification → app opens + navigates to correct screen
- Notification center displays history
- User can toggle notifications on/off

**Done When:**
- Admin can send notifications
- Members receive + see them
- Notification routing works

**Estimated Time:** 4-5 hours (FCM setup, notification UI, routing)

**Yadithya Input Needed:**
- Test device phone numbers for FCM testing

---

### Day 11: Admin Users + Roles Management

**Goals:**
- Super Admin can view all users
- Super Admin can assign roles (Super Admin / Content Admin / Host / Member)
- Roles enforced by security rules (not just UI)

**Work:**
- Admin: Users page (table showing all users, name, email, phone, role, join date)
- Admin: Role selector (dropdown to change role, Super Admin only)
- Admin: Role change confirmation
- Cloud Functions: Validate role change (only Super Admin can change roles)
- Firestore security rules: Enforce role at database level (already done Day 3)

**Testing:**
- Super Admin can view all users
- Super Admin can change roles
- Content Admin cannot access users page
- Role changes take effect immediately (user loses/gains access)
- Audit log records role change

**Done When:**
- Users page functional
- Role assignment working
- Audit logs accurate

**Estimated Time:** 2-3 hours (users UI, role logic)

**Yadithya Input Needed:**
- Test admin account creations

---

### Day 12: Real Device Testing + Bug Fixes

**Goals:**
- Test mobile app on real iPhone + Android
- Document + fix bugs
- Verify real-time sync on live network

**Work:**
- iOS: Run on real iPhone via TestFlight
- Android: Run on real Android via Play Store internal testing
- Test every screen:
  - Home (daily verse loads, announcements display)
  - Bible (navigation smooth, search works, language toggle)
  - Songs (playback, favorites)
  - Events (detail, WATCH LIVE)
  - Profile (edit, settings, logout)
  - Notifications (send from admin, receive on member)
- Test network conditions (slow/offline)
- Document bugs (prioritize critical, defer polish)
- Fix critical bugs

**Testing Matrix:**
| Feature | iPhone | Android | Result |
|---------|--------|---------|--------|
| Home screen | ? | ? | ? |
| Bible read | ? | ? | ? |
| Bible search | ? | ? | ? |
| Songs | ? | ? | ? |
| Events | ? | ? | ? |
| Notifications | ? | ? | ? |
| Profile | ? | ? | ? |
| Admin dashboard (web) | Chrome | Chrome | ? |

**Done When:**
- All P0 features work on both devices
- No crashes on normal usage
- Real-time updates work on live network
- Bug list created

**Estimated Time:** 6-8 hours (testing + bug fixes)

**Yadithya Input Needed:**
- Actively test on devices
- Report bugs + issues

---

### Day 13: Admin Dashboard Completion (Settings + Refinement)

**Goals:**
- Admin settings page complete (church name, logo, description)
- Admin dashboard polished
- Form validation + error handling

**Work:**
- Admin: Settings page (church name input + logo URL + description textarea + support email)
- Admin: Save button + confirmation
- Admin: Form validation (required fields, URL validation)
- Admin: Error handling (network errors, validation errors)
- Admin: Loading states (spinner while saving)
- Admin: Success messages (confirmation toast)
- Refinement: Sidebar navigation, responsive layout

**Testing:**
- Settings save to Firestore
- Mobile app displays updated church info
- Form validation prevents bad data
- Error messages helpful
- No crashes

**Done When:**
- Settings page functional + polished
- Admin dashboard complete for V1

**Estimated Time:** 3-4 hours (settings UI, validation, refinement)

**Yadithya Input Needed:**
- Provide church name, logo URL, description for testing

---

### Day 14: Documentation + Code Review

**Goals:**
- Key documentation written
- Code reviewed for quality + security
- Ready for Week 3 deployment prep

**Work:**
- README.md: Project overview, quick start, tech stack
- ARCHITECTURE.md: System design, data flow, decisions
- SECURITY.md: Auth, RBAC, security controls, threats
- ADMIN_GUIDE.md: Step-by-step for church staff (with screenshots)
- CONTRIBUTING.md: Code standards for future developers
- Code review: Check for secrets, error handling, logging, accessibility
- Dependency audit: `npm audit` (fix vulnerabilities)

**Testing:**
- Another developer can clone + run locally in 15 min
- Admin guide is clear for non-programmer
- No secrets in code
- No console errors

**Done When:**
- Documentation complete + accurate
- Code review passed
- Ready for production

**Estimated Time:** 6-8 hours (documentation + review)

**Yadithya Input Needed:**
- Review documentation for accuracy

---

## Week 2 Summary

**By End of Week 2:**
- ✅ Bible module complete (read + search + dark mode + language toggle)
- ✅ Profile + settings complete
- ✅ Notifications end-to-end (admin send → member receive)
- ✅ Admin user/role management complete
- ✅ Tested on real iPhone + Android devices
- ✅ Documentation started
- ✅ Bugs identified + prioritized

**Status:** Mobile app feature-complete, admin dashboard complete. Ready for Week 3 polish + deployment.

**Total Hours:** ~32-35 hours

---

## Week 3: Testing, Hardening, Deployment Prep

### Day 15: Unit + Integration Tests

**Goals:**
- Unit tests for critical paths
- Integration tests with Firebase Emulator
- Test coverage report

**Work:**
- Unit tests: Auth logic, input validators, data transformers
- Unit tests: Redux/Context slices (if using)
- Integration tests: Sign-in flow end-to-end
- Integration tests: Create announcement → verify Firestore → verify mobile
- Integration tests: Security rules (authorized vs unauthorized)
- Test coverage report (target 60%+ critical paths)

**Testing:**
- `npm run test` passes (all tests green)
- No test flakiness
- Coverage report generated

**Done When:**
- 60%+ test coverage
- All tests pass
- No regressions

**Estimated Time:** 5-6 hours (test writing, debugging)

**Yadithya Input Needed:**
- Review test results

---

### Day 16: Security Hardening + Final Review

**Goals:**
- Security audit complete
- No hardcoded secrets
- HTTPS enforced everywhere
- Ready for production

**Work:**
- Security scan: Check for API keys, credentials in code
- `git log --all -S "FIREBASE"` (verify no secrets in history)
- HTTPS verification (all Firebase calls secure)
- Authentication flow review (no plaintext passwords)
- Authorization review (security rules tested)
- Dependency vulnerability scan: `npm audit`
- Enable Firestore backups + monitoring

**Testing:**
- Security audit checklist: 100% pass
- No hardcoded credentials found
- All API calls HTTPS
- Audit logs verified

**Done When:**
- Security review passed
- Ready for production deployment
- No critical vulnerabilities

**Estimated Time:** 4-5 hours (security review + setup)

**Yadithya Input Needed:**
- Review security checklist

---

### Day 17: App Store Preparation

**Goals:**
- iOS app ready for App Store submission
- Android app ready for Play Store submission
- Metadata complete (title, description, screenshots)

**Work:**
- iOS app icon (1024x1024 + required sizes)
- iOS launch screen (professional, branded)
- iOS privacy policy (in-app link + PDF)
- iOS terms of service (in-app link + PDF)
- iOS app name + description
- iOS screenshots (5-8 screenshots showing key features)
- iOS bundle ID + version (1.0.0)
- Android same: app icon, launch screen, privacy policy, terms, description, screenshots, version
- Build final iOS + Android binaries

**Testing:**
- iOS TestFlight build installs without errors
- Android Play Store internal test build installs without errors
- App store listings look professional
- Privacy policy readable in-app

**Done When:**
- Both apps built + metadata complete
- Ready to submit (not submitted yet)

**Estimated Time:** 5-6 hours (assets, metadata, builds)

**Yadithya Input Needed:**
- Provide church logo (high resolution for app icon)
- Review app store listings
- Approve privacy policy + terms

---

### Day 18: Performance + Accessibility Refinement

**Goals:**
- App launches quickly (<3 seconds)
- Screens transition smoothly (<1 second)
- Accessibility standards met (contrast, touch targets)

**Work:**
- Profile app launch (should be <3 seconds)
- Optimize images (compress, right dimensions)
- Optimize large lists (virtualization if needed)
- Accessibility review: Contrast ratios (WCAG AA), touch targets (44x44 points)
- Adjust font sizes + colors for readability
- Test keyboard navigation (admin dashboard)
- Test screen readers (if applicable)

**Testing:**
- App launch profiled: <3 seconds target
- Screens load <1 second
- Contrast ratios: 4.5:1 minimum
- Touch targets: 44x44 points minimum

**Done When:**
- Performance meets targets
- Accessibility standards met
- App feels polished

**Estimated Time:** 4-5 hours (optimization, refinement)

**Yadithya Input Needed:**
- Test on slow network (simulate 3G)

---

### Day 19: Final E2E Testing on Real Devices

**Goals:**
- Complete end-to-end workflow test
- No crashes on normal usage
- Church staff can use admin dashboard independently

**Work:**
- Admin creates announcement → publishes → mobile member sees it within 1 second
- Admin creates daily verse + image → mobile home displays correctly
- Admin sets event + marks LIVE → mobile shows WATCH LIVE → YouTube opens
- Admin sends notification → member receives → taps → navigates correctly
- Admin manages roles → permissions take effect
- Test all screens in light + dark mode
- Test on slow network + offline scenarios
- Collect feedback from church staff (if available)

**Testing:**
- Complete workflow: admin content → mobile display ✅
- No crashes ✅
- Real-time sync verified ✅
- Admin dashboard usable by non-programmer ✅

**Done When:**
- E2E workflow proven
- No critical issues
- Ready for submission

**Estimated Time:** 5-6 hours (testing + final fixes)

**Yadithya Input Needed:**
- Actively test workflows
- Report any remaining issues

---

### Day 20: App Store + Play Store Submission

**Goals:**
- iOS app submitted to App Store
- Android app submitted to Google Play
- Both in review queue

**Work:**
- Apple Developer Account: Create app listing
- iOS: Fill in app details (title, description, category, keywords, etc.)
- iOS: Upload screenshots + app preview video (optional)
- iOS: Upload app binary (from TestFlight)
- iOS: Submit for review (Apple reviews within 24-48 hours)
- Google Play Developer Account: Create app listing
- Android: Fill in app details
- Android: Upload screenshots
- Android: Upload app binary
- Android: Submit for review (Google reviews within 2-4 hours)

**Testing:**
- App Store listing complete + accurate
- Play Store listing complete + accurate
- No rejection reasons (check guidelines beforehand)

**Done When:**
- Both apps in review queue
- Awaiting approval

**Estimated Time:** 3-4 hours (store setup, submissions)

**Yadithya Input Needed:**
- Approve store listings before submit

---

### Day 21: Monitoring Setup + Handoff Documentation

**Goals:**
- Production monitoring configured
- Runbooks written (troubleshooting, emergency procedures)
- Church staff trained

**Work:**
- Firebase Console: Enable monitoring + error tracking
- Cloud Logging: Set up alerts (high error rate, quota exceeded)
- Cloud Monitoring: Dashboard setup (if using)
- Documentation:
  - DEPLOYMENT.md: How to update app (if patch needed)
  - TROUBLESHOOTING.md: Common issues + fixes
  - ADMIN_GUIDE.md: Finalized with screenshots
  - RUNBOOK.md: Emergency procedures (if backup restore needed)
- Church staff training: Walk through admin dashboard, answer questions
- Knowledge transfer (if handing off to another developer)

**Testing:**
- Monitoring alerts working
- Documentation is accurate + complete
- Church staff comfortable with admin dashboard

**Done When:**
- Monitoring live
- Runbooks complete
- Staff trained
- Ready for production

**Estimated Time:** 4-5 hours (setup, documentation, training)

**Yadithya Input Needed:**
- Participate in staff training
- Collect feedback

---

## Week 3 Summary

**By End of Week 3:**
- ✅ Unit + integration tests complete
- ✅ Security hardened + reviewed
- ✅ App Store + Play Store ready
- ✅ iOS submitted to App Store (awaiting approval)
- ✅ Android submitted to Google Play (awaiting approval)
- ✅ Production monitoring configured
- ✅ Documentation complete
- ✅ Church staff trained

**Status:** V1 submitted, awaiting app store approval. Production-ready to deploy upon approval.

**Total Hours:** ~25-30 hours

---

## 21-Day Total

| Week | Hours | Status |
|------|-------|--------|
| Week 1 | 32-35 | Backend + Admin core + mobile basics |
| Week 2 | 32-35 | Mobile expansion + testing on devices |
| Week 3 | 25-30 | Testing, hardening, submission |
| **Total** | **89-100** | **Complete V1** |

**Buffer:** We estimated 80 hours available. Actual: 89-100 hours of work.

**How this works:** Most hours are coding (Claude-assisted). Yadithya spends ~20-30 hours on testing, approval, review, training. Not all parallel, but enough parallelization to fit in 21 calendar days with aggressive schedule.

---

# F. DAY-1 PREREQUISITES

**Before Day 1, you must provide/create:**

## Accounts & Access

- [ ] **Google Cloud Account** (for Firebase projects)
  - Create Firebase project (dev + staging)
  - Note project IDs

- [ ] **Apple Developer Account** ($99/year)
  - Ready to deploy to TestFlight
  - App ID created (bethaniya-ministries or similar)

- [ ] **Google Play Developer Account** ($750 one-time)
  - Ready to deploy to internal testing
  - App ID created

- [ ] **GitHub Account**
  - Ready to create repository
  - Settings reviewed

- [ ] **Vercel Account** (optional, for admin dashboard hosting)
  - Or use Firebase Hosting instead

## Development Environment

- [ ] **Mac/Linux/Windows Machine**
  - Node.js 18+ installed
  - npm or yarn available
  - Git installed
  - 80 GB free space (for builds, node_modules)

## Test Devices

- [ ] **iPhone**
  - Model: ___________
  - iOS version: ________
  - Can install from TestFlight: YES / NO
  - Configured for Apple Developer account: YES / NO

- [ ] **Android Phone**
  - Model: ____________
  - Android version: _______
  - Can install from Play Store internal testing: YES / NO
  - Configured for Google Play account: YES / NO

## Content & Branding

- [ ] **Church Logo**
  - Format: PNG or SVG (high resolution 512x512+)
  - Or description so we can use placeholder

- [ ] **Colors**
  - Primary color hex: #_________ (e.g., #2563EB)
  - Secondary color hex: #_________ (e.g., #7C3AED)
  - Or use default Material-UI colors for V1

- [ ] **Church Information**
  - Church name: ______________
  - Description: ______________
  - Support email: ____________

- [ ] **Test Content**
  - 5 sample announcements (title + text)
  - 3-5 sample daily verse images (16:9, 1-2 MB each)
  - 5 sample songs (title + artist + audio URL if possible)
  - 3 sample events (title + date + location)

## Decisions (from Section C)

- [ ] **English Bible source decided**
  - [ ] A) Contact API.Bible (starting today)
  - [ ] B) Use open-source Bible (research today)
  - [ ] C) Use placeholder data for V1, real Bible later

- [ ] **Telugu Bible source decided**
  - [ ] A) Contact Bible Society of India (starting today)
  - [ ] B) Research open-source Telugu (today)
  - [ ] C) Use placeholder for V1, real Telugu in V2

---

# G. REMAINING BLOCKERS

**Genuine blockers (prevent Day 1 start if unresolved):**

## BLOCKER 1: Bible Licensing (CRITICAL)

**Status:** Not verified

**Resolution:** Must decide on Bible sourcing approach by Day 1

**Impact if unresolved:** 
- Cannot implement Bible module until decision made
- Can proceed with other features (auth, admin, songs, events, etc.)
- Bible is P0 feature, so launch blocked

**Action:** 
- You contact API.Bible OR
- You research open-source Bible OR
- You approve placeholder approach
- Recommend: Start today, have answer by end of tomorrow

**Fallback:** Placeholder verses for V1 testing, real Bible licensing resolved by Day 3-5

---

## BLOCKER 2: Test Devices (MODERATE)

**Status:** Unknown which models you have

**Resolution:** Confirm iPhone + Android model numbers by Day 1

**Impact if unresolved:**
- Cannot test on real devices in Week 2
- Can still develop + test on simulators (not ideal)
- Real device testing deferred to V2 (risky, may miss bugs)

**Action:** Provide exact model numbers

**Fallback:** If no real devices available, defer real device testing to V2 (not recommended)

---

## BLOCKER 3: Firebase + App Store Accounts (MODERATE)

**Status:** Unknown if created

**Resolution:** Create Firebase, Apple Developer, Google Play Developer accounts by Day 1

**Impact if unresolved:**
- Cannot deploy to Firebase
- Cannot build for iOS/Android
- Cannot submit to app stores

**Action:** Create accounts today

**Fallback:** None (accounts required)

---

# H. FINAL RECOMMENDATION

**Question: Are we ready to start Day 1?**

## My Assessment: YES, with clarifications

### What's Solid ✅
- ✅ Architecture is sound (Firebase + Expo is proven, suitable choice)
- ✅ Tech stack evaluated (Supabase considered, Firebase better)
- ✅ Security model is solid (RBAC, audit logging, no secrets)
- ✅ Scope is realistic (15-18 P0+P1 features, not 60)
- ✅ Timeline is achievable (21 days for quality V1)
- ✅ Admin/Host is mandatory first-class product
- ✅ Quality gate defined (not shipping broken code on Day 21)
- ✅ Documentation planned
- ✅ Testing strategy realistic

### What Needs Your Decision ⚠️
1. **English Bible source:** API.Bible vs open vs placeholder
2. **Telugu Bible source:** Licensed vs open vs placeholder  
3. **Test devices:** Confirm iPhone + Android models
4. **Accounts:** Create Firebase + Apple + Google Play accounts
5. **Content:** Provide test content (announcements, songs, images)

### What Will Block Day 1 ❌
- If you haven't decided on Bible sourcing approach
- If test devices confirmed unavailable
- If Firebase account not created

---

## Prerequisites Checklist Before "START V1 — DAY 1"

**Print and check off:**

### Accounts Ready
- [ ] Firebase projects created (dev + staging)
- [ ] Apple Developer account ready
- [ ] Google Play Developer account ready
- [ ] GitHub account ready

### Decisions Made
- [ ] English Bible: [ ] API.Bible [ ] Open [ ] Placeholder
- [ ] Telugu Bible: [ ] Licensed [ ] Open [ ] Placeholder
- [ ] Architecture approved: [ ] YES (no more changes)
- [ ] Tech stack approved: [ ] YES (Expo + Firebase locked)
- [ ] 21-day timeline realistic: [ ] YES (or adjusted to: ___ days)

### Devices Confirmed
- [ ] iPhone model & iOS version: _______________
- [ ] Android model & version: ________________
- [ ] Both available by Day 8: [ ] YES [ ] NO

### Content Ready
- [ ] Test announcements created: [ ] YES [ ] NO (can create later)
- [ ] Test images provided: [ ] YES [ ] NO (can use placeholders)
- [ ] Church branding (logo + colors): [ ] YES [ ] NO (can use default)

### Commitment
- [ ] 80 hours available over 21 days: [ ] YES [ ] ADJUSTED
- [ ] Active testing Week 2: [ ] YES [ ] NO
- [ ] Will work with Claude Code daily: [ ] YES [ ] NO
- [ ] Will review code + make decisions: [ ] YES [ ] NO

---

## Go / No-Go Decision

**If all above checked ✅ → Ready for: START V1 — DAY 1**

**If any ❌ → Resolve, then send: START V1 — DAY 1**

**Do NOT send START without:**
1. Bible sourcing approach decided
2. Test devices confirmed
3. Firebase account created
4. Commitment confirmed

---

# FINAL SUMMARY

## Architecture Baseline (APPROVED)

**No changes from original architecture specification.** Firebase + Expo + React remain optimal for this project.

**Changes made to address your clarifications:**
- ✅ Removed redux (use Context instead)
- ✅ Added real backup/recovery strategy (not just version history)
- ✅ Simplified auth (kept Google, Apple, Phone OTP; good balance)
- ✅ Revised scope (15-18 realistic features vs 60 overambitious)
- ✅ Added launch quality gate (quality > deadline)
- ✅ Architecture can evolve (approved baseline, major changes need approval)
- ✅ Admin/Host confirmed mandatory first-class product
- ✅ Bible requirement locked (Telugu + English, not downgrading to English-only without approval)

---

## V1 Scope (FINAL)

**P0 (15 Must-Ship Features):**
1. Authentication (Google, Apple, Phone OTP)
2. Home screen (daily verse + announcements)
3. Bible (English + Telugu, if legally available)
4. Events (list + detail + WATCH LIVE)
5. Songs (list + play + favorites)
6. Profile (edit, settings, logout)
7. Admin: Announcements CRUD
8. Admin: Daily verse management
9. Admin: Songs CRUD
10. Admin: Events CRUD
11. Admin: Live stream manager
12. Admin: User roles + permissions
13. Push Notifications
14. RBAC (4 roles)
15. Settings (church info)

**P1 (Ship if time permits, cut if slipping):**
- Bible search
- Bible copy/share
- Dark mode
- Text size
- Admin settings page
- Notification log
- Other polish

**V2 (post-launch):**
- Donations, bookmarks, audio, more languages, reminders, etc.

---

## Bible Status (TRANSPARENCY)

**English:** Not verified for legal use
**Telugu:** Not verified for legal use
**Fallback:** Placeholder verses for testing until licensing resolved

**NO BLOCKING ISSUE** — Can proceed with other development while licensing researched in parallel.

---

## Timeline Estimate

**Realistic: 89-100 hours of work over 21 calendar days**

Breakdown:
- Week 1: 32-35 hours (foundation)
- Week 2: 32-35 hours (mobile + admin)
- Week 3: 25-30 hours (testing + deployment)

**Includes:** Coding, testing, debugging, documentation, code review

**Does NOT include:** Church staff training (counted separately, Day 21)

**Assumes:** Quality gate satisfied by Day 21 (not shipping broken code just because calendar says launch)

---

## Recommendation

**✅ READY TO START if you:**

1. Confirm Bible sourcing approach (decide method, contact sources today)
2. Confirm test devices available (iPhone + Android models by Day 1)
3. Confirm accounts created (Firebase, Apple, Google Play)
4. Confirm decision on admin/host (LOCKED: mandatory V1)
5. Confirm decision on architecture (LOCKED: Expo + Firebase approved)
6. Confirm 21-day timeline is realistic (or adjust)
7. Commit to active involvement (testing, approval, decisions)

**Then reply:** START V1 — DAY 1

**No more planning. Only building.**

---

**End of validation pass.**

**Next step: Await your "START V1 — DAY 1" message.**
