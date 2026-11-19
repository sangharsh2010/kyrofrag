import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';

export const ADMIN_EMAIL = 'sangharshkale182010@gmail.com';
export const ADMIN_UPI_ID = 'sangharshkale182010@okhdfcbank';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAmjPtZzMMdAVPrzdJghcYQ3qhNHy5-qrE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'ff-tournament-app-d213b.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ff-tournament-app-d213b',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'ff-tournament-app-d213b.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '506542674410',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:506542674410:web:c0b89664a128f642aa2293',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-X3MSHGZPTH',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(errInfo.error);
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firebase client is offline. Please verify your Firebase configuration.');
    }
  }
}
