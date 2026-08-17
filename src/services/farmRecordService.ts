import { FarmRecord } from "@/types";
import { firestoreRepo } from "@/repo/firestoreRepository";

export class FarmRecordService {
    subscribeFarmRecords(callback: (records: FarmRecord[]) => void) {
        return firestoreRepo.subscribeFarmRecords(callback);
    }

    async addFarmRecord(data: Omit<FarmRecord, "id" | "created_at">): Promise<string> {
        return firestoreRepo.addFarmRecord(data);
    }

    async deleteFarmRecord(id: string): Promise<void> {
        return firestoreRepo.deleteFarmRecord(id);
    }
}

export const farmRecordService = new FarmRecordService();
