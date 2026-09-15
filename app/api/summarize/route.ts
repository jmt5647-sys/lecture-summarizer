import { NextRequest, NextResponse } from "next/server";
import { parseOffice } from "officeparser";
import { GoogleGenAI } from "@google/genai";
import { get } from "@vercel/blob";
import { generateContentWithRetry, toFriendlyGeminiErrorMessage } from "@/lib/geminiRetry";

export const maxDuration = 120; // 2 minutes for processing large documents

// Gemini 모델명: 환경변수로 재정의 가능하며 기본값은 gemini-3.6-flash
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const SYSTEM_PROMPT = `당신은 대학 강의자료를 학생용 시험 대비 요약으로 변환하는 전문가입니다.

입력된 강의자료 텍스트에는 각 슬라이드/페이지 위치를 나타내는 "--- [p.01] ---", "--- [p.02] ---" 등의 페이지 마커가 포함되어 있습니다.
입력된 강의자료 텍스트를 다음 형식으로 요약하세요:

1. 맨 위에 전체 내용을 아우르는 요약 문단 (핵심 용어는 **볼드** 처리, 출처 페이지가 있다면 문장 뒤에 p.01 형식으로 명시)
2. 원본 슬라이드 순서를 따라 "### N. 소제목 (p.06)" 형식으로 섹션 구분 및 해당 섹션의 시작/주요 페이지 번호 기재
3. 각 섹션 안에서:
   - 개념 정의와 세부 내용을 불릿으로 정리하고, 각 내용이 언급된 페이지 번호를 문장 옆에 작게 p.06 형식으로 달아주세요. (예: "머신러닝은 데이터 기반 학습 알고리즘이다. p.06")
   - 비교가 필요한 내용은 마크다운 표로 정리 (표 내부 항목에도 필요시 p.07 등 표기)
   - 개념 간 위계/인과관계가 있으면 "A → B (p.08)" 형식으로 표시
   - 핵심 정의는 > 블록쿼트로 강조하고 출처 페이지 p.XX 표기
4. 각 섹션 마지막에 반드시 "쉬운 설명" 문단을 추가하세요:
   - 전문 용어를 일상 비유로 바꿔 설명
   - 구어체, 비유, 예시 중심
   - 원문 사례(기업명 등)는 유지하되 왜 그런지 쉽게 풀어서 설명

시험에 나올 만한 핵심 개념(정의, 분류 체계, 숫자로 된 프레임워크)은 절대 누락하지 마세요.
반드시 각 핵심 설명과 정의마다 원본 강의자료 몇 페이지에서 온 내용인지 문장 옆에 p.XX 형식으로 정확하게 달아두어야 합니다.`;

// AST 노드에서 재귀적으로 텍스트 추출 및 페이지 마커 부착
function extractTextWithPageMarkers(parseResult: unknown): string {
  if (typeof parseResult === "string") return parseResult;
  if (!parseResult || typeof parseResult !== "object") return "";

  const ast = parseResult as {
    content?: Array<{
      type?: string;
      text?: string;
      children?: unknown[];
      metadata?: { slideNumber?: number; pageNumber?: number };
    }>;
    toText?: () => string;
  };

  const getNodeText = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    const n = node as { text?: string; children?: unknown[] };
    if (typeof n.text === "string" && n.text.trim()) return n.text;
    if (Array.isArray(n.children) && n.children.length > 0) {
      return n.children.map(getNodeText).filter(Boolean).join("\n");
    }
    return "";
  };

  if (!Array.isArray(ast.content) || ast.content.length === 0) {
    return typeof ast.toText === "function" ? ast.toText() : "";
  }

  const content = ast.content;
  const hasSlidesOrPages = content.some(
    (n) => n.type === "slide" || n.type === "page"
  );

  if (hasSlidesOrPages) {
    const parts: string[] = [];
    content.forEach((node, idx) => {
      const num =
        node.metadata?.slideNumber ??
        node.metadata?.pageNumber ??
        idx + 1;
      const pageTag = `[p.${String(num).padStart(2, "0")}]`;
      const text = getNodeText(node).trim();
      if (text) {
        parts.push(`--- ${pageTag} ---\n${text}`);
      }
    });
    if (parts.length > 0) return parts.join("\n\n");
  }

  // 슬라이드/페이지 구분이 명시적이지 않은 경우 (DOCX 등) 분량 기반 페이지 추정
  let currentPage = 1;
  let currentLen = 0;
  const pageChunks: string[] = [];
  let currentChunk: string[] = [];

  content.forEach((node) => {
    const text = getNodeText(node).trim();
    if (text) {
      currentChunk.push(text);
      currentLen += text.length;
      if (currentLen > 1200) {
        const pageTag = `[p.${String(currentPage).padStart(2, "0")}]`;
        pageChunks.push(`--- ${pageTag} ---\n${currentChunk.join("\n")}`);
        currentPage++;
        currentChunk = [];
        currentLen = 0;
      }
    }
  });

  if (currentChunk.length > 0) {
    const pageTag = `[p.${String(currentPage).padStart(2, "0")}]`;
    pageChunks.push(`--- ${pageTag} ---\n${currentChunk.join("\n")}`);
  }

  if (pageChunks.length > 0) return pageChunks.join("\n\n");

  return typeof ast.toText === "function" ? ast.toText() : "";
}

// 텍스트를 문맥(단락/줄바꿈) 기준으로 청크로 분할
function splitIntoChunks(text: string, maxChunkSize = 10000, overlap = 500): string[] {
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + maxChunkSize;
    if (endIndex >= text.length) {
      chunks.push(text.slice(startIndex));
      break;
    }

    // 단락이나 줄바꿈 위치 탐색
    const lastNewline = text.lastIndexOf("\n", endIndex);
    if (lastNewline > startIndex + maxChunkSize * 0.7) {
      endIndex = lastNewline;
    }

    chunks.push(text.slice(startIndex, endIndex).trim());
    startIndex = Math.max(startIndex + 1, endIndex - overlap);
  }

  return chunks.filter((c) => c.length > 0);
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일에 유효한 Gemini API 키를 입력해주세요.",
        },
        { status: 500 }
      );
    }

    const { fileUrl, fileName: rawFileName } = (await req.json()) as {
      fileUrl?: string;
      fileName?: string;
    };

    if (!fileUrl || !rawFileName) {
      return NextResponse.json(
        { error: "업로드된 파일 정보가 없습니다." },
        { status: 400 }
      );
    }

    // 파일 확장자 검사
    const fileName = rawFileName;
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions = ["pptx", "pdf", "docx"];

    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        {
          error: `지원하지 않는 파일 형식입니다 (${ext}). .pptx, .pdf, .docx 파일만 지원됩니다.`,
        },
        { status: 400 }
      );
    }

    // Vercel Blob에서 파일 다운로드 (대용량 파일도 서버리스 함수 요청 본문 제한 없이 처리)
    const blobResult = await get(fileUrl, { access: "private" });
    if (!blobResult || !blobResult.stream) {
      return NextResponse.json(
        { error: "업로드된 파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    const arrayBuffer = await new Response(blobResult.stream).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: "업로드된 파일의 크기가 0바이트입니다." },
        { status: 422 }
      );
    }

    // officeparser로 텍스트 추출 및 페이지 마커 태깅
    let extractedText = "";
    try {
      const parseResult = await parseOffice(buffer, {
        fileType: ext as "pptx" | "pdf" | "docx",
      });

      extractedText = extractTextWithPageMarkers(parseResult);
    } catch (parseError) {
      console.error("officeparser extraction error:", parseError);
      return NextResponse.json(
        {
          error:
            "문서에서 텍스트를 추출하는 데 실패했습니다. 파일이 손상되었거나 지원되지 않는 양식일 수 있습니다. (422 Unprocessable Entity)",
        },
        { status: 422 }
      );
    }

    const trimmedText = extractedText.trim();
    if (!trimmedText) {
      return NextResponse.json(
        {
          error:
            "문서에서 추출된 텍스트가 없습니다. 이미지 전용 PDF 또는 빈 슬라이드일 수 있습니다. (422 Unprocessable Entity)",
        },
        { status: 422 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const textLength = trimmedText.length;
    let finalSummary = "";
    let isChunked = false;
    let chunkCount = 1;

    // 15000자 이하: 한 번에 요약
    if (textLength <= 15000) {
      const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME,
        contents: `[강의자료 본문 (페이지 번호 태그 포함)]\n${trimmedText}`,
        config: {
          systemInstruction: SYSTEM_PROMPT,
        },
      });

      finalSummary = response.text || "";
    } else {
      // 15000자 초과: 청크 분할 후 Map-Reduce 요약
      isChunked = true;
      const chunks = splitIntoChunks(trimmedText, 10000, 500);
      chunkCount = chunks.length;

      // 1단계 Map: 각 청크별 핵심 개념, 구조 및 페이지 출처 보존
      const mapSummaries: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const mapPrompt = `다음은 대용량 강의자료의 일부(청크 ${i + 1}/${chunks.length})입니다.
각 문장과 항목마다 원본 페이지 태그([p.XX])를 확인하여 p.XX 형태의 출처 페이지 번호를 반드시 보존해 주세요.
강의 슬라이드 순서, 핵심 개념/정의, 비교 프레임워크, 용어 관계(A → B), 구체적 사례를 누락 없이 마크다운 형식으로 상세히 정리해 주세요.

[강의자료 청크 내용]
${chunk}`;

        const mapResponse = await generateContentWithRetry(ai, {
          model: MODEL_NAME,
          contents: mapPrompt,
        });

        if (mapResponse.text) {
          mapSummaries.push(`### [강의자료 파트 ${i + 1}]\n${mapResponse.text}`);
        }
      }

      // 2단계 Reduce: 종합하여 최종 시험 대비 요약 생성 (페이지 번호 p.XX 포함)
      const combinedMapText = mapSummaries.join("\n\n---\n\n");
      const reducePrompt = `다음은 대용량 강의자료의 각 파트에서 상세 추출된 핵심 내용들입니다:

${combinedMapText}

위 파트별 내용들을 슬라이드 순서대로 유기적으로 통합하여, 요구된 시험 대비 요약 양식(전체 요약 문단, ### N. 소제목 (p.06), 불릿 및 마크다운 표, A → B 관계, > 블록쿼트 정의, 문장별 p.XX 페이지 번호 명시, 섹션별 쉬운 설명)에 맞춰 완벽한 최종 시험 대비 요약본을 작성해 주세요.`;

      const reduceResponse = await generateContentWithRetry(ai, {
        model: MODEL_NAME,
        contents: reducePrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
        },
      });

      finalSummary = reduceResponse.text || "";
    }

    return NextResponse.json({
      summary: finalSummary,
      charCount: textLength,
      chunkCount,
      isChunked,
      fileName,
    });
  } catch (error: unknown) {
    console.error("API error during summarization:", error);
    const message = toFriendlyGeminiErrorMessage(error);
    return NextResponse.json(
      { error: `요약 생성 실패: ${message}` },
      { status: 500 }
    );
  }
}
