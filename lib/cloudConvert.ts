// LibreOffice가 없는 환경(예: Vercel 서버리스)에서 PPTX/DOCX → PDF 변환을 위한
// CloudConvert REST API 폴백. https://cloudconvert.com/api/v2

const CLOUDCONVERT_BASE = "https://api.cloudconvert.com/v2";

interface CloudConvertTask {
  name: string;
  status: string;
  result?: {
    form?: { url: string; parameters: Record<string, string> };
    files?: { url: string }[];
  };
}

interface CloudConvertJob {
  id: string;
  status: string;
  tasks: CloudConvertTask[];
}

export function isCloudConvertConfigured(): boolean {
  return Boolean(process.env.CLOUDCONVERT_API_KEY);
}

export async function convertWithCloudConvert(
  buffer: Buffer,
  fileName: string
): Promise<Buffer> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) {
    throw new Error("CLOUDCONVERT_API_KEY가 설정되지 않았습니다.");
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // 1. 변환 작업(import → convert → export) 생성
  const jobRes = await fetch(`${CLOUDCONVERT_BASE}/jobs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tasks: {
        "import-file": { operation: "import/upload" },
        "convert-file": {
          operation: "convert",
          input: "import-file",
          output_format: "pdf",
        },
        "export-file": { operation: "export/url", input: "convert-file" },
      },
    }),
  });

  if (!jobRes.ok) {
    throw new Error(`CloudConvert 작업 생성 실패 (HTTP ${jobRes.status})`);
  }
  const jobData = (await jobRes.json()) as { data: CloudConvertJob };
  const importTask = jobData.data.tasks.find((t) => t.name === "import-file");
  if (!importTask?.result?.form) {
    throw new Error("CloudConvert 업로드 대상을 찾지 못했습니다.");
  }

  // 2. 파일 업로드 (CloudConvert가 지정한 presigned form으로 직접 업로드)
  const uploadForm = new FormData();
  Object.entries(importTask.result.form.parameters).forEach(([key, value]) => {
    uploadForm.append(key, value);
  });
  uploadForm.append("file", new Blob([new Uint8Array(buffer)]), fileName);

  const uploadRes = await fetch(importTask.result.form.url, {
    method: "POST",
    body: uploadForm,
  });
  if (!uploadRes.ok) {
    throw new Error(`CloudConvert 파일 업로드 실패 (HTTP ${uploadRes.status})`);
  }

  // 3. 작업 완료까지 폴링 (최대 약 40초, 서버리스 함수 실행시간 제한 고려)
  const jobId = jobData.data.id;
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusRes = await fetch(`${CLOUDCONVERT_BASE}/jobs/${jobId}`, { headers });
    if (!statusRes.ok) continue;
    const statusData = (await statusRes.json()) as { data: CloudConvertJob };

    if (statusData.data.status === "error") {
      throw new Error("CloudConvert 변환 작업이 실패했습니다.");
    }
    if (statusData.data.status === "finished") {
      const exportTask = statusData.data.tasks.find((t) => t.name === "export-file");
      const downloadUrl = exportTask?.result?.files?.[0]?.url;
      if (!downloadUrl) {
        throw new Error("CloudConvert 변환 결과 파일을 찾지 못했습니다.");
      }
      const pdfRes = await fetch(downloadUrl);
      if (!pdfRes.ok) {
        throw new Error("변환된 PDF 다운로드에 실패했습니다.");
      }
      return Buffer.from(await pdfRes.arrayBuffer());
    }
  }

  throw new Error("CloudConvert 변환이 제한 시간 내에 완료되지 않았습니다.");
}
