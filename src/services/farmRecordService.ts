import { FarmRecord } from "@/types";
import { firestoreRepo } from "@/repo/firestoreRepository";
import { uploadImagesToStorage, deleteFolderImages } from "@/utils/imageUtils";

export class FarmRecordService {
    subscribeFarmRecords(callback: (records: FarmRecord[]) => void) {
        return firestoreRepo.subscribeFarmRecords(callback);
    }

    async addFarmRecord(data: Omit<FarmRecord, "id" | "created_at">, imageFiles?: File[]): Promise<string> {
        const id = await firestoreRepo.addFarmRecord(data);

        // 이미지 업로드 실패 시 방금 만든 기록을 되돌려, 재시도 때 중복 기록이 생기지 않게 함
        if (imageFiles && imageFiles.length > 0) {
            try {
                const urls = await uploadImagesToStorage(`farmRecords/${id}`, imageFiles);
                await firestoreRepo.updateFarmRecord(id, { image_urls: urls });
            } catch (uploadError) {
                await this.deleteFarmRecord(id).catch(() => {});
                throw uploadError;
            }
        }

        return id;
    }

    async deleteFarmRecord(id: string): Promise<void> {
        await deleteFolderImages(`farmRecords/${id}`);
        return firestoreRepo.deleteFarmRecord(id);
    }
}

export const farmRecordService = new FarmRecordService();
