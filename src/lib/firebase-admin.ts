import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // 환경변수에서 개행문자(\n) 처리
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase Admin Initialized successfully');
  } catch (error) {
    console.error('Firebase Admin initialization error', error);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();

/**
 * API 라우트용: Authorization: Bearer <Firebase ID 토큰>을 검증하고,
 * 관리자이거나 권한(permission)을 가진 사용자일 때만 uid를 반환합니다. 아니면 null.
 */
export async function verifyRequestUser(request: Request, permission: 'canRead' | 'canWrite'): Promise<string | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  try {
    const { uid } = await adminAuth.verifyIdToken(token);
    const settings = (await adminDb.collection("user_settings").doc(uid).get()).data();
    return settings?.role === 'admin' || settings?.permissions?.[permission] === true ? uid : null;
  } catch {
    return null;
  }
}

export default admin;
