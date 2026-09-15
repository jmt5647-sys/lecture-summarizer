import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// 클라이언트가 Vercel Blob 스토리지에 파일을 "직접" 업로드할 수 있도록
// 짧은 유효기간의 업로드 토큰을 발급한다. 이렇게 하면 큰 강의자료 파일이
// 서버리스 함수(요청 본문 크기 제한 있음)를 거치지 않고 바로 저장된다.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        addRandomSuffix: true,
        maximumSizeInBytes: 200 * 1024 * 1024, // 200MB
      }),
      onUploadCompleted: async () => {
        // 업로드 완료 후 별도로 서버에 기록할 상태는 없음 (클라이언트가 이어서 처리)
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "업로드 토큰 발급 실패" },
      { status: 400 }
    );
  }
}
