# KINDL Leads Tracker — Team Edition

A production-ready, multi-user cloud lead management and WhatsApp outreach application built for the **KINDL** team. Upgraded from the original single-user browser `localStorage` tracker (`leads_tracker_v1`) to a real-time **Firebase Authentication + Cloud Firestore** architecture with Role-Based Access Control (RBAC), optimistic concurrency, Pakistani phone number normalization, and comprehensive audit logging.

---

## 1. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons, SheetJS (`xlsx`)
- **Backend / Cloud**:
  - **Firebase Authentication** (Email/Password + Google Sign-In)
  - **Cloud Firestore** (Real-time `onSnapshot` listeners + multi-tab offline persistence)
  - **Firestore Security Rules** (`firestore.rules` with zero-trust role & schema verification)
  - **Firebase Hosting** (`firebase.json` & `firestore.indexes.json`)

---

## 2. Where to Paste Your Firebase Configuration

By default, the application reads Firebase credentials from:
1. **Environment Variables (`.env`)** — Recommended for GitHub & CI/CD deployments:
   Copy `.env.example` to `.env` and fill in your Firebase project values:
   ```env
   VITE_FIREBASE_API_KEY="your-api-key"
   VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="your-project-id"
   VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
   VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
   VITE_FIREBASE_APP_ID="your-app-id"
   VITE_FIREBASE_DATABASE_ID="(default)"
   ```
2. **Or directly in `firebase-applet-config.json` / `src/firebase/config.ts`**:
   Open `src/firebase/config.ts` to inspect how `firebaseConfig` is initialized.

---

## 3. Enabling Authentication in Firebase Console

1. Open the [Firebase Console](https://console.firebase.google.com/) and select your project (`algebraic-gravity-3f6jr` or your custom project).
2. Navigate to **Build → Authentication → Sign-in method**.
3. Enable **Email/Password** and **Google** providers.

---

## 4. Initial First Admin Setup

The system does **not** expose any public "Make me Admin" button.

- **Automatic Bootstrap Admin**: The owner email (`azlanmaseed5963@gmail.com`) is verified in both `firestore.rules` and `src/services/authService.ts` and is automatically provisioned with `role: "admin"` and `active: true` upon first sign-in.
- **Manual Admin Creation via Firebase Console**:
  1. Create a user in **Firebase Console → Authentication → Users**.
  2. In **Firestore Database → `users` collection**, create or edit the document with ID matching the user's `uid`:
     ```json
     {
       "uid": "USER_FIREBASE_UID",
       "name": "Haris Khan",
       "email": "haris@kindl.org",
       "role": "admin",
       "active": true
     }
     ```
- Once signed in as an Admin, open the **Users** tab inside the app to create/invite additional Admins, Managers, and Team Members directly.

---

## 5. Firestore Collections & Architecture

- `users/{uid}` — Team member profile, `role` (`admin` | `manager` | `member`), `active` status, `createdAt`, and `lastLoginAt`.
- `leads/{leadId}` — Shared lead documents preserving all KINDL fields (`Full_Name`, `Phone_Number`, `phoneNormalized`, `Age`, `City`, `Source`, `Lead_Role`, `Program`, `Lead_Category`, `Status`, `Follow_Up_Time`, `WhatsApp_Message`, `Time`, `Description`), ownership (`assignedTo`, `assignedToName`), multi-user WhatsApp queue locks (`activeWorkflowBy`, `activeWorkflowByName`), soft-delete flags (`deleted`, `deletedAt`, `deletedBy`), and optimistic concurrency (`version`, `updatedAt`).
- `phoneIndex/{phoneNormalized}` — Server-side phone uniqueness registry checked inside Firestore transactions so two users cannot simultaneously create duplicate Pakistani or international phone numbers (`03001234567`, `+923001234567`, and `00923001234567` all normalize to `923001234567`).
- `leadActivities/{activityId}` — Immutable audit trail recording `leadId`, `action`, `performedBy`, `performedByName`, `timestamp`, and `details`.
- `settings/customOptions` — Shared custom dropdown options (`sources`, `roles`, `programs`, `categories`, `statuses`).

---

## 6. Migrating Legacy `localStorage` Leads (`leads_tracker_v1`)

1. Sign in to the application using an **Admin** or **Manager** account.
2. If the browser contains data under `localStorage.getItem('leads_tracker_v1')`, a **"Migrate Local Leads"** button appears in the top header (and under **Settings → Open Migration Wizard**).
3. You can also export a JSON/CSV backup from the legacy HTML app and upload it via **Import**.
4. The wizard normalizes all phone numbers, flags duplicates against Firestore, previews valid/duplicate/invalid rows, and uploads leads in batches without deleting your local backup.

---

## 7. Local Development & Deployment to Firebase Hosting

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Build production bundle
npm run build

# 4. Deploy Firestore Security Rules, Indexes, and Hosting
firebase deploy --only firestore:rules,firestore:indexes,hosting
```
