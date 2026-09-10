import { ImprovementNote } from "@/types";
import { firestoreRepo } from "@/repo/firestoreRepository";

export class ImprovementNoteService {
    subscribeImprovementNotes(callback: (notes: ImprovementNote[]) => void) {
        return firestoreRepo.subscribeImprovementNotes(callback);
    }

    async addImprovementNote(data: Omit<ImprovementNote, "id" | "created_at">): Promise<string> {
        return firestoreRepo.addImprovementNote(data);
    }

    async deleteImprovementNote(id: string): Promise<void> {
        return firestoreRepo.deleteImprovementNote(id);
    }
}

export const improvementNoteService = new ImprovementNoteService();
