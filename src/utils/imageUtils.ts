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
export const deleteFolderImages = async (folderPath: string, keepUrls: string[] = []): Promise<void> => {
  if (!storage) return;
  try {
    // 다른 문서가 아직 참조 중인 파일(예: 반복 일정 분할 후 새 마스터가 쓰는 사진)은 남겨둠
    const keepPaths = new Set(keepUrls.map(storagePathOf));
    const res = await listAll(ref(storage, folderPath));
    await Promise.all(res.items.filter(item => !keepPaths.has(item.fullPath)).map(item => deleteObject(item)));
  } catch (error) {
    console.warn(`Storage 이미지 삭제 중 오류 (${folderPath}):`, error);
  }
};

/** 다운로드 URL → Storage 경로 (파싱 불가면 빈 문자열) */
export const storagePathOf = (url: string): string => {
  try {
    return ref(storage, url).fullPath;
  } catch {
    return "";
  }
};

/** 다운로드 URL 목록의 파일을 삭제 (이미 없는 파일 등 실패는 무시) */
export const deleteImagesByUrl = async (urls: string[]): Promise<void> => {
  if (!storage) return;
  await Promise.all(urls.map(url => deleteObject(ref(storage, url)).catch(() => {})));
};

export const compressImage = async (file: File): Promise<File> => {
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
