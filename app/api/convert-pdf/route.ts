import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { get } from "@vercel/blob";
import { convertWithCloudConvert, isCloudConvertConfigured } from "@/lib/cloudConvert";

export const maxDuration = 60;

// LibreOffice headless 실행 파일 경로 후보 (환경변수로 재정의 가능)
const SOFFICE_CANDIDATES = [
  process.env.SOFFICE_PATH,
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
  "soffice",
].filter((p): p is string => Boolean(p));

async function findSoffice(): Promise<string> {
  for (const candidate of SOFFICE_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // 경로가 아니라 PATH상의 커맨드명일 수 있으므로 다음 후보 확인
    }
  }
  // 마지막 후보(PATH의 "soffice")를 그대로 시도
  return SOFFICE_CANDIDATES[SOFFICE_CANDIDATES.length - 1];
}

function runSoffice(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`soffice exited with code ${code}: ${stderr}`));
    });
  });
}

export async function POST(req: NextRequest) {
  let tmpDir: string | null = null;
  try {
    const { fileUrl, fileName } = (await req.json()) as {
      fileUrl?: string;
      fileName?: string;
    };

    if (!fileUrl || !fileName) {
      return NextResponse.json({ error: "업로드된 파일 정보가 없습니다." }, { status: 400 });
    }

    const ext = (fileName.split(".").pop() || "").toLowerCase();
    if (!["pptx", "docx"].includes(ext)) {
      return NextResponse.json(
        { error: "PPTX 또는 DOCX 파일만 PDF로 변환할 수 있습니다." },
        { status: 400 }
      );
    }

    const blobResult = await get(fileUrl, { access: "private" });
    if (!blobResult || !blobResult.stream) {
      return NextResponse.json({ error: "업로드된 파일을 찾을 수 없습니다." }, { status: 404 });
    }
    const buffer = Buffer.from(await new Response(blobResult.stream).arrayBuffer());

    let pdfBuffer: Buffer;
    try {
      // 1순위: 로컬에 설치된 LibreOffice (무료, 빠름 — 주로 로컬 개발 환경)
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lecture-conv-"));
      const inputPath = path.join(tmpDir, `input.${ext}`);
      await fs.writeFile(inputPath, buffer);

      const soffice = await findSoffice();
      await runSoffice(soffice, [
        "--headless",
        "--norestore",
        "--convert-to",
        "pdf",
        "--outdir",
        tmpDir,
        inputPath,
      ]);

      const outputPath = path.join(tmpDir, "input.pdf");
      pdfBuffer = await fs.readFile(outputPath);
    } catch (localError) {
      // 2순위: LibreOffice를 쓸 수 없는 환경(예: Vercel 서버리스)에서는
      // CloudConvert API로 폴백 (설정되어 있는 경우에만)
      if (!isCloudConvertConfigured()) {
        throw localError;
      }
      console.warn("LibreOffice 변환 실패, CloudConvert로 폴백:", localError);
      pdfBuffer = await convertWithCloudConvert(buffer, fileName);
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  } catch (error: unknown) {
    console.error("PDF conversion error:", error);
    const message =
      error instanceof Error ? error.message : "PDF 변환 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: `PDF 변환 실패: ${message}` }, { status: 500 });
  } finally {
    if (tmpDir) {
      fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
