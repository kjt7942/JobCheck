import { FarmRecord } from "@/types";
import { firestoreRepo } from "@/repo/firestoreRepository";
import { uploadImagesToStorage, deleteFolderImages } from "@/utils/imageUtils";

export class FarmRecordService {
    subscribeFarmRecords(callback: (records: FarmRecord[]) => void) {
        return firestoreRepo.subscribeFarmRecords(callback);
    }

    async addFarmRecord(data: Omit<FarmRecord, "id" | "created_at">, imageFiles?: File[]): Promise<string> {
        const id = await firestoreRepo.addFarmRecord(data);

        if (imageFiles && imageFiles.length > 0) {
            const urls = await uploadImagesToStorage(`farmRecords/${id}`, imageFiles);
            await firestoreRepo.updateFarmRecord(id, { image_urls: urls });
        }

        return id;
    }

    async deleteFarmRecord(id: string): Promise<void> {
        await deleteFolderImages(`farmRecords/${id}`);
        return firestoreRepo.deleteFarmRecord(id);
    }
}

export const farmRecordService = new FarmRecordService();
