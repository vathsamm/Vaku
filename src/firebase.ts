import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const isBrowser = typeof window !== 'undefined';
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use initializeFirestore with experimentalAutoDetectLongPolling for resilient cloud / iframe connection
export const firestoreDb = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export async function saveDbToFirestore(databaseData: any, userEmail?: string): Promise<{ ok: boolean; error?: string }> {
  if (!isBrowser || !databaseData) return { ok: false, error: 'Database data required' };

  // Only attempt Firestore write if a user is authenticated (to satisfy firestore.rules)
  if (!auth.currentUser) {
    return { ok: false, error: 'User not signed in' };
  }

  try {
    const docRef = doc(firestoreDb, 'app_db', 'main_state');
    
    const payload = {
      id: 'main_state',
      version: databaseData.version || 3,
      updated_at: Date.now(),
      last_sync_email: userEmail || auth.currentUser.email || 'system',
      data_json: JSON.stringify({
        version: databaseData.version,
        folders: databaseData.folders || {},
        video_editor_projects: databaseData.video_editor_projects || {},
        config: databaseData.config || {},
        users: databaseData.users || {},
        admins: databaseData.admins || [],
        audios: databaseData.audios || {},
        audio_folders: databaseData.audio_folders || {},
        folder_audio_settings: databaseData.folder_audio_settings || {},
        master_bucket_settings: databaseData.master_bucket_settings || {},
      })
    };

    await setDoc(docRef, payload, { merge: true });

    fetch('/api/sync/report_firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'synced', docId: 'main_state' })
    }).catch(() => {});

    return { ok: true };
  } catch (err: any) {
    fetch('/api/sync/report_firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', error: err?.message || 'Firestore save notice' })
    }).catch(() => {});
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function fetchDbFromFirestore(): Promise<any | null> {
  if (!isBrowser || !auth.currentUser) return null;
  try {
    const docRef = doc(firestoreDb, 'app_db', 'main_state');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.data_json) {
        return JSON.parse(data.data_json);
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}
