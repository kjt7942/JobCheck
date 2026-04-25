import { UserSettings } from "@/types";
import { firestoreRepo } from "@/repo/firestoreRepository";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

export class AdminService {
    /**
     * 모든 사용자 리스트를 가져옵니다.
     */
    async fetchAllUsers(): Promise<UserSettings[]> {
        return await firestoreRepo.getAllUserSettings();
    }

    /**
     * 사용자의 권한 또는 신분을 업데이트합니다.
     */
    async updateUserAuth(uid: string, updates: Partial<UserSettings>, currentAdminEmail: string): Promise<void> {
        const allUsers = await this.fetchAllUsers();
        const targetUser = allUsers.find(u => u.user_id === uid);

        if (!targetUser) throw new Error("사용자를 찾을 수 없습니다.");

        // 1. 최후의 관리자 보호 로직
        if (updates.role === 'user' && targetUser.role === 'admin') {
            const adminCount = allUsers.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                throw new Error("최소 한 명의 관리자가 존재해야 합니다. 권한을 해제할 수 없습니다.");
            }
        }

        // 2. 관리자 승격 알림 로직 (admin으로 수정 시)
        if (updates.role === 'admin' && targetUser.role !== 'admin') {
            await this.notifyAdminPromotion(targetUser, currentAdminEmail);
        }

        // 3. 실제 업데이트 수행
        const newSettings = { ...targetUser, ...updates };
        await firestoreRepo.saveUserSettings(newSettings);
    }

    /**
     * 관리자 승격 알림을 기록합니다 (이메일 발송용 컬렉션 등 활용 가능).
     */
    private async notifyAdminPromotion(user: UserSettings, promoterEmail: string) {
        if (!db) return;
        try {
            // 'notifications' 컬렉션에 기록 (앱 내 알림용)
            await firestoreRepo.addNotification({
                type: 'ADMIN_PROMOTION',
                title: '관리자 승격 알림',
                target_user: user.email,
                target_user_name: user.user_name,
                promoter: promoterEmail,
                message: `${user.user_name}(${user.email}) 계정이 관리자로 승격되었습니다.`,
            });

            // 주 관리자(kjt7942@gmail.com)에게 이메일 발송을 위한 전용 컬렉션 (Trigger Email 확장용)
            await addDoc(collection(db, "mail"), {
                to: "kjt7942@gmail.com",
                message: {
                    subject: "[꿀송이농장] 관리자 승격 알림",
                    html: `
                        <h3>관리자 승격 알림</h3>
                        <p>다음 사용자가 관리자로 승격되었습니다.</p>
                        <ul>
                            <li>대상: ${user.user_name} (${user.email})</li>
                            <li>승인자: ${promoterEmail}</li>
                            <li>일시: ${new Date().toLocaleString()}</li>
                        </ul>
                    `
                }
            });
        } catch (error) {
            console.error("알림 생성 중 오류:", error);
        }
    }

    /**
     * 사용자 계정을 완전히 삭제합니다.
     */
    async removeUser(uid: string): Promise<void> {
        const allUsers = await this.fetchAllUsers();
        const targetUser = allUsers.find(u => u.user_id === uid);

        if (targetUser?.role === 'admin') {
            const adminCount = allUsers.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                throw new Error("마지막 관리자는 삭제할 수 없습니다.");
            }
        }

        await firestoreRepo.deleteUserSettings(uid);
    }
}

export const adminService = new AdminService();
