import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// 앱 초기화 (환경 변수가 있을 때만 실행하여 빌드 오류 방지)
const app = getApps().length > 0 
  ? getApp() 
  : (firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null);

// Firestore: 브라우저에서는 IndexedDB 오프라인 캐시 사용 (재접속 시 즉시 표시, 전파가 약한 밭에서도 조회/기록 가능)
function createDb(): Firestore | null {
  if (!app) return null;
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    return getFirestore(app); // HMR 등으로 이미 초기화된 경우
  }
}

// 서비스 인스턴스 내보내기 (환경변수 누락 시 null — AppProvider가 안내 화면을 띄움)
export const db = createDb() as Firestore;
export const auth = (app ? getAuth(app) : null) as Auth;
export const storage = (app ? getStorage(app) : null) as FirebaseStorage;

/**
 * 로그인한 사용자의 Firebase ID 토큰을 Authorization 헤더에 실어 내부 API(/api/*)를 호출합니다.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await auth?.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

if (!firebaseConfig.apiKey) {
  console.warn("⚠️ Firebase API Key가 누락되었습니다. Vercel 환경 변수 설정을 확인해주세요.");
}

export default app;
