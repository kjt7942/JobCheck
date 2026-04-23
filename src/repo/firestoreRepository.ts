import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Job, UserSettings } from "@/types";

export class FirestoreRepository {
  private get jobsCol() {
    if (!db) throw new Error("Firebase가 초기화되지 않았습니다.");
    return collection(db, "jobs");
  }

  private get settingsCol() {
    if (!db) throw new Error("Firebase가 초기화되지 않았습니다.");
    return collection(db, "user_settings");
  }

  // --- User Settings ---

  async getUserSettings(uid: string): Promise<UserSettings | null> {
    const docRef = doc(this.settingsCol, uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as UserSettings;
    }
    return null;
  }

  async saveUserSettings(settings: UserSettings): Promise<void> {
    const docRef = doc(this.settingsCol, settings.user_id);
    await setDoc(docRef, {
      ...settings,
      updated_at: Date.now()
    });
  }

  // --- Jobs ---

  async getJobs(date?: string): Promise<Job[]> {
    // 모든 유저의 데이터를 공유하므로 user_id 필터 제거
    let q = query(
      this.jobsCol,
      orderBy("created_at", "asc")
    );

    const querySnapshot = await getDocs(q);
    const allJobs = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Timestamp 날짜 처리
      let jobDate = data.date;
      if (jobDate instanceof Timestamp) {
        jobDate = jobDate.toDate().toISOString();
      }

      return {
        id: doc.id,
        ...data,
        date: jobDate
      } as Job;
    });

    // 날짜가 지정된 경우 필터링
    if (date) {
      return allJobs.filter(job => job.date.startsWith(date));
    }

    return allJobs;
  }

  async subscribeJobs(callback: (jobs: Job[]) => void, date?: string): Promise<() => void> {
    let q = query(
      this.jobsCol,
      orderBy("created_at", "asc")
    );

    return onSnapshot(q, (querySnapshot) => {
      const allJobs = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let jobDate = data.date;
        if (jobDate instanceof Timestamp) {
          jobDate = jobDate.toDate().toISOString();
        }

        return {
          id: doc.id,
          ...data,
          date: jobDate
        } as Job;
      });

      if (date) {
        callback(allJobs.filter(job => job.date.startsWith(date)));
      } else {
        callback(allJobs);
      }
    });
  }

  async addJob(job: Omit<Job, "id" | "created_at">): Promise<string> {
    const newJob = {
      ...job,
      created_at: Date.now()
    };
    const docRef = await addDoc(this.jobsCol, newJob);
    return docRef.id;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<void> {
    const docRef = doc(this.jobsCol, id);
    await updateDoc(docRef, updates);
  }

  async deleteJob(id: string): Promise<void> {
    const docRef = doc(this.jobsCol, id);
    await deleteDoc(docRef);
  }
}

export const firestoreRepo = new FirestoreRepository();
