/**
 * 브라우저 기본 Canvas API를 이용한 이미지 압축 유틸리티
 */

import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage";

/**
 * 압축된 이미지 파일들을 Storage의 지정 폴더에 업로드하고 다운로드 URL 목록을 반환합니다.
 */
export const uploadImagesToStorage = async (folderPath: string, files: File[]): Promise<string[]> => {
  if (!storage) throw new Error("Storage가 초기화되지 않았습니다.");

  const uploadPromises = files.map(async (file, index) => {
    const fileName = `${Date.now()}_${index}_${file.name}`;
    const storageRef = ref(storage, `${folderPath}/${fileName}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  });

  return await Promise.all(uploadPromises);
};

/**
 * 지정 폴더의 모든 이미지를 Storage에서 삭제합니다.
 */
export const deleteFolderImages = async (folderPath: string): Promise<void> => {
  if (!storage) return;
  try {
    const res = await listAll(ref(storage, folderPath));
    await Promise.all(res.items.map(item => deleteObject(item)));
  } catch (error) {
    console.warn(`Storage 이미지 삭제 중 오류 (${folderPath}):`, error);
  }
};

export const compressImage = async (file: File, maxSizeMB: number = 1): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // 해상도 조절: 최대 가로/세로 800px로 제한 (데이터 절약 및 로딩 속도 최적화)
        const MAX_SIZE = 800;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // 품질 조절 (0.7 ~ 0.8 사이가 효율적)
        // 1MB 제한을 위해 품질을 동적으로 조절하는 대신, 
        // 일반적으로 0.7 품질 + 1280px 해상도면 대부분 1MB 이하로 압축됨
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas to Blob conversion failed"));
              return;
            }
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          0.7
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};
