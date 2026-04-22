import { 
  onAuthStateChanged, 
  User,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { firestoreRepo } from "@/repo/firestoreRepository";
import { UserSettings } from "@/types";

export class AuthService {
  /**
   * 인증 상태 변경을 감시하고, 사용자가 로그인하면 설정을 함께 가져옵니다.
   */
  subscribeAuthStatus(callback: (user: User | null, settings: UserSettings | null) => void) {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 사용자가 로그인한 경우 설정 로드
        const settings = await firestoreRepo.getUserSettings(user.uid);
        callback(user, settings);
      } else {
        callback(null, null);
      }
    });
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

    // 초기 사용자 설정 생성
    const initialSettings: UserSettings = {
      user_id: user.uid,
      email: email,
      user_name: userName,
      farm_name: "꿀송이농장",
      latitude: 37.5665,
      longitude: 126.9780,
      location: "서울",
      start_day: 0,
      theme: 'light',
      updated_at: Date.now()
    };

    await firestoreRepo.saveUserSettings(initialSettings);
    return { user, settings: initialSettings };
  }

  /**
   * 구글 로그인
   */
  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    // 기존 설정이 있는지 확인
    const existingSettings = await firestoreRepo.getUserSettings(user.uid);
    
    if (!existingSettings) {
      // 첫 로그인이라면 초기 설정 생성
      const initialSettings: UserSettings = {
        user_id: user.uid,
        email: user.email || "",
        user_name: user.displayName || "농장 가족",
        farm_name: "꿀송이농장",
        latitude: 37.5665,
        longitude: 126.9780,
        location: "서울",
        start_day: 0,
        theme: 'light',
        updated_at: Date.now()
      };
      await firestoreRepo.saveUserSettings(initialSettings);
      return { user, settings: initialSettings };
    }

    return { user, settings: existingSettings };
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
}

export const authService = new AuthService();
