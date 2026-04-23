import { Job } from "@/types";
import { firestoreRepo } from "@/repo/firestoreRepository";

export class JobService {
    /**
     * 일정 목록을 가져옵니다.
     * @param date 특정 날짜 필터 (YYYY-MM-DD 형식)
     */
    async fetchJobs(date?: string): Promise<Job[]> {
        try {
            return await firestoreRepo.getJobs(date);
        } catch (error) {
            console.error("JobService: Error fetching jobs", error);
            throw error;
        }
    }

    /**
     * 실시간 일정 구독을 설정합니다.
     */
    async subscribeJobs(callback: (jobs: Job[]) => void, date?: string) {
        return await firestoreRepo.subscribeJobs(callback, date);
    }

    /**
     * 새 일정을 등록합니다.
     */
    async createJob(jobData: Omit<Job, "id" | "created_at">): Promise<string> {
        try {
            return await firestoreRepo.addJob(jobData);
        } catch (error) {
            console.error("JobService: Error creating job", error);
            throw error;
        }
    }

    /**
     * 일정을 업데이트합니다.
     */
    async updateJob(id: string, updates: Partial<Job>): Promise<void> {
        try {
            await firestoreRepo.updateJob(id, updates);
        } catch (error) {
            console.error("JobService: Error updating job", error);
            throw error;
        }
    }

    /**
     * 일정을 삭제합니다.
     */
    async deleteJob(id: string): Promise<void> {
        try {
            await firestoreRepo.deleteJob(id);
        } catch (error) {
            console.error("JobService: Error deleting job", error);
            throw error;
        }
    }

    /**
     * 할일의 완료 상태를 토글합니다.
     */
    async toggleTaskDone(id: string, is_done: boolean): Promise<void> {
        try {
            await firestoreRepo.updateJob(id, { is_done });
        } catch (error) {
            console.error("JobService: Error toggling task status", error);
            throw error;
        }
    }
}

export const jobService = new JobService();
