// IndexedDB에 업로드된 원본 파일(Blob)을 저장/조회하기 위한 헬퍼.
// localStorage는 문서 목록(요약 텍스트)만 저장하고, 용량이 큰 원본 파일은 여기서 별도 관리한다.

const DB_NAME = "lecture_files_db";
const STORE_NAME = "files";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFileBlob(id: string, file: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFileBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFileBlob(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// PPTX/DOCX는 브라우저에서 직접 렌더링할 수 없으므로, 서버에서 PDF로 변환한
// 결과물을 원본과 별도 키(view_<id>)로 저장해 좌측 뷰어 렌더링에 사용한다.
const viewKey = (id: string) => `view_${id}`;

export async function saveViewPdf(id: string, file: Blob): Promise<void> {
  return saveFileBlob(viewKey(id), file);
}

export async function getViewPdf(id: string): Promise<Blob | null> {
  return getFileBlob(viewKey(id));
}

export async function deleteViewPdf(id: string): Promise<void> {
  return deleteFileBlob(viewKey(id));
}
