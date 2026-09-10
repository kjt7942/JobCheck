import { ImprovementNote } from "@/types";
import { firestoreRepo } from "@/repo/firestoreRepository";

export class ImprovementNoteService {
    subscribeImprovementNotes(callback: (notes: ImprovementNote[]) => void) {
        return firestoreRepo.subscribeImprovementNotes(callback);
    }

    async addImprovementNote(data: Omit<ImprovementNote, "id" | "created_at">): Promise<string> {
        return firestoreRepo.addImprovementNote(data);
    }

    async updateImprovementNote(id: string, updates: Partial<ImprovementNote>): Promise<void> {
        return firestoreRepo.updateImprovementNote(id, updates);
    }

    async deleteImprovementNote(id: string): Promise<void> {
        return firestoreRepo.deleteImprovementNote(id);
    }
}

export const improvementNoteService = new ImprovementNoteService();
