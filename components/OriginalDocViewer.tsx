"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileWarning,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface OriginalDocViewerProps {
  // 렌더링할 PDF 바이트. PDF 원본이거나, PPTX/DOCX를 서버에서 변환한 결과.
  pdfBlob: Blob | null;
  // 다운로드 버튼에서 사용할 실제 원본 파일 바이트 (변환 성공 여부와 무관하게 항상 원본).
  originalBlob: Blob | null;
  isLoadingBlob: boolean;
  fileType: "pdf" | "pptx" | "docx";
  fileName: string;
  targetPage: number | null;
}

export default function OriginalDocViewer({
  pdfBlob,
  originalBlob,
  isLoadingBlob,
  fileType,
  fileName,
  targetPage,
}: OriginalDocViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState<number>(480);

  const fileUrl = useMemo(
    () => (pdfBlob ? URL.createObjectURL(pdfBlob) : null),
    [pdfBlob]
  );

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  // 문서가 바뀌면 페이지 상태 초기화
  useEffect(() => {
    setCurrentPage(1);
    setNumPages(0);
    setLoadError(null);
  }, [fileUrl]);

  // 요약본에서 p.XX 클릭 시 해당 페이지로 이동
  useEffect(() => {
    if (targetPage && targetPage >= 1) {
      setCurrentPage(numPages > 0 ? Math.min(targetPage, numPages) : targetPage);
    }
  }, [targetPage, numPages]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setPageWidth(Math.max(240, Math.floor(width - 16)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const goPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goNext = () => setCurrentPage((p) => Math.min(numPages || p + 1, p + 1));

  const handleDownloadOriginal = () => {
    if (!originalBlob) return;
    const url = URL.createObjectURL(originalBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoadingBlob) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center gap-2 bg-[#12141d] border border-[#202433] rounded-xl text-slate-500 text-xs">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>원본 파일 불러오는 중...</span>
      </div>
    );
  }

  // PDF 렌더링 대상이 없을 때: 원본이 아예 없거나(재업로드 필요), 또는
  // PPTX/DOCX의 PDF 변환이 실패한 경우. 두 경우 모두 다운로드 폴백을 제공.
  if (!pdfBlob) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center gap-3 bg-[#12141d] border border-[#202433] rounded-xl text-slate-400 text-xs p-6 text-center">
        <FileWarning className="w-7 h-7 text-slate-600" />
        <p className="font-medium text-slate-300">{fileName}</p>
        {originalBlob ? (
          <>
            <p className="text-slate-500">
              {fileType.toUpperCase()} 파일의 PDF 미리보기 변환에 실패했어요.
              <br />
              원본을 다운로드해서 확인해주세요.
            </p>
            <button
              type="button"
              onClick={handleDownloadOriginal}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#272b3a] bg-[#14161f] hover:bg-[#1c202d] text-slate-300 text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>원본 다운로드</span>
            </button>
          </>
        ) : (
          <span className="text-slate-600">
            원본 파일을 찾을 수 없습니다. 다시 업로드하면 미리보기를 볼 수 있어요.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#12141d] border border-[#202433] rounded-xl overflow-hidden">
      {/* Page Nav Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#202433] flex-shrink-0 gap-2">
        <span className="text-[11px] text-slate-500 truncate" title={fileName}>
          {fileName}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentPage <= 1}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1c202c] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-300 min-w-[52px] text-center">
              {currentPage} / {numPages || "-"}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={numPages > 0 && currentPage >= numPages}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1c202c] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {originalBlob && (
            <button
              type="button"
              onClick={handleDownloadOriginal}
              title="원본 파일 다운로드"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1c202c] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* PDF Render Area */}
      <div ref={containerRef} className="flex-1 overflow-auto p-2 flex justify-center">
        {loadError ? (
          <div className="flex flex-col items-center justify-center gap-2 text-slate-500 text-xs py-12">
            <FileWarning className="w-6 h-6 text-slate-600" />
            <span>PDF를 불러오지 못했습니다.</span>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setLoadError("load-error")}
            loading={
              <div className="flex flex-col items-center justify-center gap-2 text-slate-500 text-xs py-12">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>PDF 불러오는 중...</span>
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              width={pageWidth}
              renderAnnotationLayer={false}
              renderTextLayer={true}
            />
          </Document>
        )}
      </div>
    </div>
  );
}
