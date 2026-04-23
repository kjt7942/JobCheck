import { Job } from "@/types";
import { firestoreRepo } from "@/repo/firestoreRepository";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage";

export class JobService {
    /**
     * 일정 목록을 가져옵니다.
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
    async createJob(jobData: Omit<Job, "id" | "created_at">, imageFiles?: File[]): Promise<string> {
        try {
            // 1. 일정 먼저 생성 (ID 확보)
            const jobId = await firestoreRepo.addJob(jobData);

            // 2. 이미지가 있으면 업로드 후 업데이트
            if (imageFiles && imageFiles.length > 0) {
                const urls = await this.uploadImages(jobId, imageFiles);
                await this.updateJob(jobId, { image_urls: urls });
            }

            return jobId;
        } catch (error) {
            console.error("JobService: Error creating job", error);
            throw error;
        }
    }

    /**
     * 이미지를 업로드하고 URL 리스트를 반환합니다.
     */
    private async uploadImages(jobId: string, files: File[]): Promise<string[]> {
        if (!storage) throw new Error("Storage가 초기화되지 않았습니다.");

        const uploadPromises = files.map(async (file, index) => {
            const fileName = `${Date.now()}_${index}_${file.name}`;
            const storageRef = ref(storage, `jobs/${jobId}/${fileName}`);
            const snapshot = await uploadBytes(storageRef, file);
            return await getDownloadURL(snapshot.ref);
        });

        return await Promise.all(uploadPromises);
    }

    /**
     * 일정을 업데이트합니다.
     */
    async updateJob(id: string, updates: Partial<Job>, newImageFiles?: File[]): Promise<void> {
        try {
            // 신규 이미지 파일이 있는 경우 업로드 후 URL 리스트 업데이트
            if (newImageFiles && newImageFiles.length > 0) {
                const newUrls = await this.uploadImages(id, newImageFiles);
                
                // 만약 updates에 이미 image_urls가 있다면(일부 삭제된 상태) 거기서 추가, 
                // 없으면 서버에서 다시 가져와서 추가
                let baseUrls: string[] = [];
                if (updates.image_urls) {
                    baseUrls = updates.image_urls;
                } else {
                    const currentJob = (await firestoreRepo.getJobs()).find(j => j.id === id);
                    baseUrls = currentJob?.image_urls || [];
                }
                
                updates.image_urls = [...baseUrls, ...newUrls];
            }

            await firestoreRepo.updateJob(id, updates);
        } catch (error) {
            console.error("JobService: Error updating job", error);
            throw error;
        }
    }

    /**
     * 일정을 삭제합니다 (관련 이미지도 모두 삭제).
     */
    async deleteJob(id: string): Promise<void> {
        try {
            // 1. Storage 이미지 삭제
            await this.deleteAllImages(id);
            // 2. Firestore 데이터 삭제
            await firestoreRepo.deleteJob(id);
        } catch (error) {
            console.error("JobService: Error deleting job", error);
            throw error;
        }
    }

    /**
     * 특정 일정의 모든 이미지를 Storage에서 삭제합니다.
     */
    private async deleteAllImages(jobId: string): Promise<void> {
        if (!storage) return;
        const folderRef = ref(storage, `jobs/${jobId}`);
        try {
            const res = await listAll(folderRef);
            const deletePromises = res.items.map(item => deleteObject(item));
            await Promise.all(deletePromises);
        } catch (error) {
            console.warn("Storage 이미지 삭제 중 오류 (이미지가 없을 수 있음):", error);
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
