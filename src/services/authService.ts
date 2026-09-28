import {
  onAuthStateChanged,
  User,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { firestoreRepo } from "@/repo/firestoreRepository";
import { UserSettings } from "@/types";
import { FARM_LAT, FARM_LNG } from "@/lib/weather";

export class AuthService {
  /**
   * 인증 상태 변경을 감시합니다. (사용자 설정은 AppProvider에서 실시간 구독)
   */
  subscribeAuthStatus(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  }

  /**
   * 신규 사용자의 초기 설정(권한 모두 false)을 저장하고 관리자에게 승인 요청 알림을 남깁니다.
   */
  private async createInitialSettings(uid: string, email: string, userName: string): Promise<UserSettings> {
    const initialSettings: UserSettings = {
      user_id: uid,
      email,
      user_name: userName,
      farm_name: "꿀송이농장",
      latitude: FARM_LAT,
      longitude: FARM_LNG,
      location: "문경시",
      start_day: 0,
      theme: 'light',
      role: 'user',
      permissions: {
        canRead: false,
        canWrite: false,
        canDelete: false
      },
      updated_at: Date.now()
    };

    await firestoreRepo.saveUserSettings(initialSettings);

    // 관리자에게 새 사용자 가입 알림
    await firestoreRepo.addNotification({
      type: 'NEW_USER',
      title: '새로운 가입 승인 대기',
      message: `${userName}(${email})님이 가입했습니다. 권한 승인이 필요합니다.`,
      user_id: uid
    });

    return initialSettings;
  }

  /**
   * 소셜 로그인 직후: 설정 문서가 없으면(첫 로그인) 초기 설정을 생성합니다.
   */
  private async ensureSettings(user: User): Promise<UserSettings> {
    const existingSettings = await firestoreRepo.getUserSettings(user.uid);
    return existingSettings ?? this.createInitialSettings(user.uid, user.email || "", user.displayName || "농장 가족");
  }

  /**
   * 로그인
   */
  async login(email: string, pass: string) {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    return userCredential.user;
  }

  /**
   * 회원가입 (계정 추가) 및 초기 설정 저장
   */
  async signup(email: string, pass: string, userName: string) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;
    const settings = await this.createInitialSettings(user.uid, email, userName);
    return { user, settings };
  }

  /**
   * 구글 로그인
   */
  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;
    return { user, settings: await this.ensureSettings(user) };
  }

  /**
   * 구글 로그인 (리다이렉트 방식) - 팝업 차단 시 사용
   */
  async loginWithGoogleRedirect() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithRedirect(auth, provider);
  }

  /**
   * 리다이렉트 결과 처리
   */
  async handleRedirectResult() {
    const result = await getRedirectResult(auth);
    if (result) {
      await this.ensureSettings(result.user);
    }
    return result;
  }

  /**
   * 로그아웃
   */
  async logout() {
    await signOut(auth);
  }

  /**
   * 사용자 설정 저장 (업데이트)
   */
  async updateSettings(settings: UserSettings) {
    await firestoreRepo.saveUserSettings(settings);
  }

  /**
   * 사용자 설정 가져오기
   */
  async getSettings(uid: string) {
    return await firestoreRepo.getUserSettings(uid);
  }
}

export const authService = new AuthService();
