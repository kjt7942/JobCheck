import { Job } from "@/types";
import { firestoreRepo } from "@/repo/firestoreRepository";
import { uploadImagesToStorage, deleteFolderImages, deleteImagesByUrl, storagePathOf } from "@/utils/imageUtils";

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
    async subscribeJobs(callback: (jobs: Job[]) => void, date?: string, onError?: (e: Error) => void) {
        return await firestoreRepo.subscribeJobs(callback, date, onError);
    }

    /**
     * 새 일정을 등록합니다.
     */
    async createJob(jobData: Omit<Job, "id" | "created_at">, imageFiles?: File[]): Promise<string> {
        try {
            // 1. 일정 먼저 생성 (ID 확보)
            // 반복 일정의 특정 날짜 오버라이드(취소/수정 인스턴스)는 (group_id, instance_date)로
            // 결정적 ID를 써서, 중복 클릭이나 동시 요청으로 같은 취소/수정 문서가 여러 개 생기지 않게 함.
            const jobId = (jobData.group_id && jobData.instance_date)
                ? await firestoreRepo.setJobInstance(`${jobData.group_id}_${jobData.instance_date}`, jobData)
                : await firestoreRepo.addJob(jobData);

            // 2. 이미지가 있으면 업로드 후 업데이트 (실패 시 방금 만든 문서를 되돌려, 재시도 때 중복 등록 방지)
            if (imageFiles && imageFiles.length > 0) {
                try {
                    const urls = await uploadImagesToStorage(`jobs/${jobId}`, imageFiles);
                    await firestoreRepo.updateJob(jobId, { image_urls: [...(jobData.image_urls ?? []), ...urls] });
                } catch (uploadError) {
                    await this.deleteJob(jobId).catch(() => {});
                    throw uploadError;
                }
            }

            return jobId;
        } catch (error) {
            console.error("JobService: Error creating job", error);
            throw error;
        }
    }

    /**
     * 일정을 업데이트합니다.
     */
    async updateJob(id: string, updates: Partial<Job>, newImageFiles?: File[]): Promise<void> {
        try {
            // 신규 이미지 파일이 있는 경우 업로드 후 URL 리스트 업데이트
            if (newImageFiles && newImageFiles.length > 0) {
                const newUrls = await uploadImagesToStorage(`jobs/${id}`, newImageFiles);
                
                // 만약 updates에 이미 image_urls가 있다면(일부 삭제된 상태) 거기서 추가, 
                // 없으면 서버에서 다시 가져와서 추가
                let baseUrls: string[] = [];
                if (updates.image_urls) {
                    baseUrls = updates.image_urls;
                } else {
                    const currentJob = await firestoreRepo.getJob(id);
                    baseUrls = currentJob?.image_urls || [];
                }
                
                updates = { ...updates, image_urls: [...baseUrls, ...newUrls] };
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
    async deleteJob(id: string, keepUrls: string[] = []): Promise<void> {
        try {
            // 1. Storage 이미지 삭제 (다른 일정이 참조 중인 파일은 유지)
            await deleteFolderImages(`jobs/${id}`, keepUrls);
            // 2. Firestore 데이터 삭제
            await firestoreRepo.deleteJob(id);
        } catch (error) {
            console.error("JobService: Error deleting job", error);
            throw error;
        }
    }

    /**
     * 일정에서 빠진 사진 중 이 일정 폴더에 있고 다른 일정이 참조하지 않는 파일을 Storage에서 삭제합니다.
     */
    async deleteUnusedImages(id: string, removedUrls: string[], stillUsedUrls: string[]): Promise<void> {
        const used = new Set(stillUsedUrls.map(storagePathOf));
        const targets = removedUrls.filter(u => {
            const path = storagePathOf(u);
            return path.startsWith(`jobs/${id}/`) && !used.has(path);
        });
        if (targets.length > 0) await deleteImagesByUrl(targets);
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
