import { del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

// 요약/변환 처리가 끝난 뒤 Blob 스토리지에 남아있는 원본 업로드 파일을 정리한다.
// 클라이언트는 IndexedDB에 이미 원본을 보관하고 있으므로 서버 측 사본은 필요 없다.
export async function POST(req: NextRequest) {
  try {
    const { fileUrl } = await req.json();
    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl이 필요합니다." }, { status: 400 });
    }
    await del(fileUrl);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Blob cleanup error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "정리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
