import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

import firebaseAppletConfig from '../firebase-applet-config.json';

const getEnv = (key: string, fallback: string) => {
  const val = import.meta.env[key];
  if (!val || val === 'none' || val === '') return fallback;
  return val;
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', firebaseAppletConfig.apiKey),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', firebaseAppletConfig.authDomain),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', firebaseAppletConfig.projectId),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', firebaseAppletConfig.storageBucket),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', firebaseAppletConfig.messagingSenderId),
  appId: getEnv('VITE_FIREBASE_APP_ID', firebaseAppletConfig.appId),
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID', firebaseAppletConfig.measurementId),
};

const firestoreDatabaseId = getEnv('VITE_FIREBASE_DATABASE_ID', firebaseAppletConfig.firestoreDatabaseId);

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
}, firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  
  // Specific hint for connectivity issues
  let userFriendlyError = message;
  if (message.includes('unavailable') || message.includes('offline') || message.includes('Could not reach Cloud Firestore')) {
    userFriendlyError = '서버 접속이 원활하지 않습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도해 주세요.';
  }

  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(userFriendlyError);
}

async function testConnection() {
  try {
    // Force a fetch from the server to verify connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test successful.");
  } catch (error: any) {
    if (error.code === 'unavailable') {
      console.warn("Firestore backend is currently unreachable. The app will work in offline mode if cached data exists.");
    } else {
      console.error("Firestore connectivity check failed:", error.message);
    }
  }
}
testConnection();
