import { SprayRecord } from "@/types";
import { firestoreRepo } from "@/repo/firestoreRepository";

export class SprayService {
    subscribeSprayRecords(callback: (records: SprayRecord[]) => void) {
        return firestoreRepo.subscribeSprayRecords(callback);
    }

    async addSprayRecord(data: Omit<SprayRecord, "id" | "created_at">): Promise<string> {
        return firestoreRepo.addSprayRecord(data);
    }

    async deleteSprayRecord(id: string): Promise<void> {
        return firestoreRepo.deleteSprayRecord(id);
    }
}

export const sprayService = new SprayService();
