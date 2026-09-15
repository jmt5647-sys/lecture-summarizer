"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { upload } from "@vercel/blob/client";
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Copy,
  CheckCircle2,
  ArrowLeft,
  MoreVertical,
  ChevronRight,
  Loader2,
  Sparkles,
  Folder,
  FolderPlus,
  User,
  Sun,
  Moon,
  UploadCloud,
  X,
  BookOpen,
} from "lucide-react";
import QuizSection from "@/components/QuizSection";
import OriginalDocViewer from "@/components/OriginalDocViewer";
import { QuizResponse } from "@/app/api/quiz/route";
import {
  saveFileBlob,
  getFileBlob,
  deleteFileBlob,
  saveViewPdf,
  getViewPdf,
  deleteViewPdf,
} from "@/lib/fileStore";

export interface SavedDocument {
  id: string;
  title: string;
  fileName: string;
  fileType: "pdf" | "pptx" | "docx";
  createdAt: string;
  summary: string;
  charCount: number;
  quiz?: QuizResponse | null;
  folderId?: string | null;
}

export interface DocFolder {
  id: string;
  name: string;
  createdAt: string;
}

export default function Home() {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [view, setView] = useState<"library" | "viewer">("library");
  const [activeTab, setActiveTab] = useState<"summary" | "quiz">("summary");

  // 과목별 폴더 상태
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderMenuOpenDocId, setFolderMenuOpenDocId] = useState<string | null>(null);

  // 업로드 모달 상태
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStep, setUploadStep] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 드롭다운 메뉴 상태 (문서 삭제 등)
  const [menuOpenDocId, setMenuOpenDocId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 원본 파일 뷰어 상태
  const [viewerPdfBlob, setViewerPdfBlob] = useState<Blob | null>(null);
  const [viewerOriginalBlob, setViewerOriginalBlob] = useState<Blob | null>(null);
  const [isLoadingBlob, setIsLoadingBlob] = useState<boolean>(false);
  const [targetPage, setTargetPage] = useState<number | null>(null);

  // 텍스트 내의 p.06 또는 (p.06) 패턴을 감지하여 클릭 가능한 모노 배지로 변환
  // 클릭 시 왼쪽 원본 뷰어가 해당 페이지로 이동한다.
  const formatPageCitations = (text: string) => {
    const parts = text.split(/(\(?p\.\d{1,3}\)?)/gi);
    if (parts.length === 1) return text;

    return parts.map((part, i) => {
      const match = part.match(/\(?p\.(\d{1,3})\)?/i);
      if (match) {
        const pageNum = parseInt(match[1], 10);
        return (
          <button
            key={i}
            type="button"
            onClick={() => setTargetPage(pageNum)}
            className="inline-flex items-center text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded text-indigo-300 bg-[#1e2333] border border-[#2d344d] ml-1 align-baseline hover:bg-[#2a3150] hover:border-indigo-500/70 hover:text-indigo-200 transition-colors cursor-pointer"
            title={`원문 ${pageNum}페이지로 이동`}
          >
            p.{String(pageNum).padStart(2, "0")}
          </button>
        );
      }
      return part;
    });
  };

  const renderWithPageCitations = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === "string") {
      return formatPageCitations(children);
    }
    if (Array.isArray(children)) {
      return React.Children.map(children, (child) => renderWithPageCitations(child));
    }
    return children;
  };

  // 로컬 스토리지에서 저장된 문서 목록 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem("saved_documents");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setDocuments(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load saved documents:", e);
    }
  }, []);

  // 로컬 스토리지에서 저장된 폴더(과목) 목록 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem("saved_folders");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFolders(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load saved folders:", e);
    }
  }, []);

  // 문서 목록 변경 시 로컬 스토리지 저장
  const saveDocumentsToStorage = (newDocs: SavedDocument[]) => {
    setDocuments(newDocs);
    try {
      localStorage.setItem("saved_documents", JSON.stringify(newDocs));
    } catch (e) {
      console.error("Failed to save documents to storage:", e);
    }
  };

  // 폴더 목록 변경 시 로컬 스토리지 저장
  const saveFoldersToStorage = (newFolders: DocFolder[]) => {
    setFolders(newFolders);
    try {
      localStorage.setItem("saved_folders", JSON.stringify(newFolders));
    } catch (e) {
      console.error("Failed to save folders to storage:", e);
    }
  };

  // 새 폴더(과목) 만들기
  const handleCreateFolder = () => {
    const name = window.prompt("새 폴더(과목) 이름을 입력하세요:");
    if (!name || !name.trim()) return;
    const newFolder: DocFolder = {
      id: `folder_${Date.now()}`,
      name: name.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    saveFoldersToStorage([...folders, newFolder]);
    setActiveFolderId(newFolder.id);
  };

  // 폴더 삭제 (폴더에 속한 문서는 미분류로 이동)
  const handleDeleteFolder = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    if (
      !window.confirm(
        `"${folder.name}" 폴더를 삭제하시겠습니까? 폴더 안의 문서는 삭제되지 않고 미분류로 이동합니다.`
      )
    )
      return;

    saveFoldersToStorage(folders.filter((f) => f.id !== folderId));
    saveDocumentsToStorage(
      documents.map((d) => (d.folderId === folderId ? { ...d, folderId: null } : d))
    );
    if (activeFolderId === folderId) setActiveFolderId(null);
  };

  // 문서를 특정 폴더로 이동 (null이면 미분류로 이동)
  const handleMoveDocToFolder = (docId: string, folderId: string | null) => {
    saveDocumentsToStorage(
      documents.map((d) => (d.id === docId ? { ...d, folderId } : d))
    );
    setFolderMenuOpenDocId(null);
    setMenuOpenDocId(null);
  };

  const activeDoc = documents.find((d) => d.id === activeDocId) || null;
  const visibleDocuments = activeFolderId
    ? documents.filter((d) => d.folderId === activeFolderId)
    : documents;

  // 뷰어 화면 진입 시 IndexedDB에서 원본 파일(+PDF 미리보기) 불러오기
  // PDF는 원본 자체를 렌더링하고, PPTX/DOCX는 업로드 시 서버에서 변환해 둔 PDF를 렌더링한다.
  useEffect(() => {
    if (view !== "viewer" || !activeDocId) {
      setViewerPdfBlob(null);
      setViewerOriginalBlob(null);
      return;
    }
    let cancelled = false;
    setIsLoadingBlob(true);
    setTargetPage(null);
    const docFileType = activeDoc?.fileType;

    (async () => {
      try {
        const original = await getFileBlob(activeDocId);
        if (cancelled) return;
        setViewerOriginalBlob(original);

        if (docFileType === "pdf") {
          setViewerPdfBlob(original);
        } else {
          const converted = await getViewPdf(activeDocId);
          if (!cancelled) setViewerPdfBlob(converted);
        }
      } catch {
        if (!cancelled) {
          setViewerPdfBlob(null);
          setViewerOriginalBlob(null);
        }
      } finally {
        if (!cancelled) setIsLoadingBlob(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [view, activeDocId, activeDoc?.fileType]);

  // 파일 선택 처리
  const handleFileSelect = (selectedFile: File) => {
    setUploadError(null);
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!ext || !["pptx", "pdf", "docx"].includes(ext)) {
      setUploadError(".pptx, .pdf, .docx 형식의 파일만 업로드할 수 있습니다.");
      return;
    }
    setUploadFile(selectedFile);
  };

  // 요약 생성 및 보관함에 저장
  const handleStartSummarize = async () => {
    if (!uploadFile) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadStep("파일 업로드 중...");

    try {
      // 대용량 파일도 서버리스 함수의 요청 본문 크기 제한 없이 처리할 수 있도록
      // Vercel Blob 스토리지에 파일을 직접 업로드한 뒤, 그 URL만 API로 전달한다.
      const blob = await upload(uploadFile.name, uploadFile, {
        access: "private",
        handleUploadUrl: "/api/blob-upload",
      });

      setUploadStep("강의 슬라이드 및 텍스트 분석 중...");
      const timer = setTimeout(() => {
        setUploadStep("Gemini 3.6 Flash가 시험 대비 요약본 생성 중...");
      }, 1500);

      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: blob.url, fileName: uploadFile.name }),
      });

      clearTimeout(timer);

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "요약 생성에 실패했습니다.");
      }

      const ext = (uploadFile.name.split(".").pop()?.toLowerCase() || "pdf") as
        | "pdf"
        | "pptx"
        | "docx";
      const cleanTitle = uploadFile.name.replace(/\.[^/.]+$/, "");

      const today = new Date().toISOString().slice(0, 10);
      const newDoc: SavedDocument = {
        id: `doc_${Date.now()}`,
        title: cleanTitle,
        fileName: uploadFile.name,
        fileType: ext,
        createdAt: today,
        summary: data.summary,
        charCount: data.charCount,
        folderId: activeFolderId,
      };

      const updatedDocs = [newDoc, ...documents];
      saveDocumentsToStorage(updatedDocs);

      // 원본 파일을 IndexedDB에 저장 (좌측 원본 뷰어 및 다운로드에서 사용)
      try {
        await saveFileBlob(newDoc.id, uploadFile);
      } catch (e) {
        console.error("Failed to save original file:", e);
      }

      // PPTX/DOCX는 브라우저에서 직접 렌더링할 수 없으므로 서버에서 PDF로 변환해 저장
      if (ext !== "pdf") {
        setUploadStep("PPTX/DOCX를 PDF 미리보기로 변환 중...");
        try {
          const convertRes = await fetch("/api/convert-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileUrl: blob.url, fileName: uploadFile.name }),
          });
          if (convertRes.ok) {
            const pdfBlob = await convertRes.blob();
            await saveViewPdf(newDoc.id, pdfBlob);
          } else {
            console.error("PDF 변환 실패:", await convertRes.text());
          }
        } catch (e) {
          console.error("PDF 변환 요청 실패:", e);
        }
      }

      // 처리가 끝났으니 Blob 스토리지의 원본 사본은 정리 (실패해도 무시)
      fetch("/api/blob-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: blob.url }),
      }).catch(() => {});

      // 모달 닫고 즉시 뷰어로 이동
      setIsUploading(false);
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setActiveDocId(newDoc.id);
      setView("viewer");
      setActiveTab("summary");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "요청 처리 중 오류가 발생했습니다.";
      setUploadError(msg);
      setIsUploading(false);
    }
  };

  // 문서 삭제
  const handleDeleteDoc = (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("이 문서를 보관함에서 삭제하시겠습니까?")) return;

    const filtered = documents.filter((d) => d.id !== docId);
    saveDocumentsToStorage(filtered);
    deleteFileBlob(docId).catch((e) => console.error("Failed to delete original file:", e));
    deleteViewPdf(docId).catch((e) => console.error("Failed to delete converted PDF:", e));

    if (activeDocId === docId) {
      setActiveDocId(null);
      setView("library");
    }
    setMenuOpenDocId(null);
  };

  // 퀴즈 저장
  const handleSaveQuizToDoc = (docId: string, quizData: QuizResponse) => {
    const updated = documents.map((doc) => {
      if (doc.id === docId) {
        return { ...doc, quiz: quizData };
      }
      return doc;
    });
    saveDocumentsToStorage(updated);
  };

  const handleCopySummary = async () => {
    if (!activeDoc?.summary) return;
    try {
      await navigator.clipboard.writeText(activeDoc.summary);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      alert("클립보드 복사에 실패했습니다.");
    }
  };

  const handleDownloadSummary = () => {
    if (!activeDoc?.summary) return;
    const blob = new Blob([activeDoc.summary], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeDoc.title}-시험요약.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen bg-[#0c0d11] text-slate-100 font-sans antialiased">
      {/* 1. Left Slim Sidebar */}
      <aside className="w-14 border-r border-[#1c1f2a] flex flex-col items-center py-4 justify-between select-none bg-[#0c0d11] flex-shrink-0 z-20">
        {/* Top items */}
        <div className="flex flex-col items-center gap-5 w-full">
          {/* Logo / Brand */}
          <button
            type="button"
            onClick={() => {
              setView("library");
              setActiveDocId(null);
            }}
            className="w-8 h-8 rounded-lg bg-[#1a1d27] border border-[#272c3d] flex items-center justify-center text-slate-200 hover:text-white hover:border-slate-500 transition-all"
            title="문서 보관함 홈"
          >
            <BookOpen className="w-4 h-4 text-indigo-400" />
          </button>

          <div className="w-6 h-[1px] bg-[#1a1d27]" />

          {/* Library button */}
          <button
            type="button"
            onClick={() => {
              setView("library");
              setActiveDocId(null);
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              view === "library"
                ? "text-indigo-400 bg-[#161823]"
                : "text-slate-500 hover:text-slate-300 hover:bg-[#161823]"
            }`}
            title="문서 목록"
          >
            <FileText className="w-4 h-4" />
          </button>

          {/* New Document (+) */}
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-[#161823] transition-colors"
            title="새로 만들기"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* New Folder (과목별 폴더 만들기) */}
          <button
            type="button"
            onClick={handleCreateFolder}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-[#161823] transition-colors"
            title="새 폴더(과목) 만들기"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom items */}
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="w-7 h-7 rounded-full bg-[#1b1e2a] border border-[#272c3d] flex items-center justify-center text-slate-400 mt-1">
            <User className="w-3.5 h-3.5" />
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {view === "library" ? (
          /* ========================================================
             VIEW A: 문서 보관함 (Library Grid)
             ======================================================== */
          <main className="p-8 max-w-7xl mx-auto w-full">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-xl font-bold text-white tracking-tight">
                문서
              </h1>
              <div className="text-xs text-slate-500">
                총 {visibleDocuments.length}개의 강의자료
              </div>
            </div>

            {/* 과목별 폴더 칩 */}
            <div className="flex items-center gap-2 mb-8 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveFolderId(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  activeFolderId === null
                    ? "bg-[#252a3a] text-white border-indigo-500/80"
                    : "bg-[#14161f] text-slate-400 border-[#242836] hover:text-slate-200"
                }`}
              >
                전체
              </button>

              {folders.map((folder) => (
                <div key={folder.id} className="relative group/chip">
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(folder.id)}
                    className={`pl-3 pr-7 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      activeFolderId === folder.id
                        ? "bg-[#252a3a] text-white border-indigo-500/80"
                        : "bg-[#14161f] text-slate-400 border-[#242836] hover:text-slate-200"
                    }`}
                  >
                    <Folder className="w-3 h-3 text-slate-500" />
                    <span>{folder.name}</span>
                    <span className="text-slate-600">
                      {documents.filter((d) => d.folderId === folder.id).length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                    title="폴더 삭제"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-600 hover:text-rose-400 opacity-0 group-hover/chip:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={handleCreateFolder}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-[#2b3144] text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all flex items-center gap-1.5"
              >
                <FolderPlus className="w-3 h-3" />
                <span>새 폴더</span>
              </button>
            </div>

            {/* Document Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* First Card: + 새로 만들기 */}
              <div
                onClick={() => setIsUploadModalOpen(true)}
                className="border border-dashed border-[#242836] hover:border-slate-500 bg-[#12141c]/50 hover:bg-[#151822] rounded-xl p-5 flex flex-col items-center justify-center min-h-[220px] cursor-pointer transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-[#1c202d] border border-[#282d3e] flex items-center justify-center text-slate-400 group-hover:text-white group-hover:border-slate-500 transition-colors mb-3">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-300 group-hover:text-white">
                  새로 만들기
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  PDF · PPTX · DOCX
                </span>
              </div>

              {/* Saved Document Cards */}
              {visibleDocuments.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => {
                    setActiveDocId(doc.id);
                    setView("viewer");
                    setActiveTab("summary");
                  }}
                  className="bg-[#14161f] border border-[#202433] hover:border-[#353b4f] rounded-xl overflow-hidden cursor-pointer transition-all flex flex-col group min-h-[220px]"
                >
                  {/* Top Preview Banner (Cover) */}
                  <div className="h-28 bg-gradient-to-br from-[#1c2333] via-[#151924] to-[#12141c] p-4 flex flex-col justify-between border-b border-[#202433] relative overflow-hidden">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>L-SUMMARY</span>
                      <span>{doc.charCount.toLocaleString()}자</span>
                    </div>

                    <div className="z-10">
                      <p className="text-xs font-bold text-slate-200 line-clamp-2 leading-snug">
                        {doc.title}
                      </p>
                    </div>

                    {/* Subtle decorative circle */}
                    <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-indigo-500/5 pointer-events-none" />
                  </div>

                  {/* Bottom Metadata */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
                        {doc.title}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#1c202c] mt-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#1e2333] text-[#7888ab] border border-[#2b3248] flex-shrink-0">
                          {doc.fileType}
                        </span>
                        <span className="text-[11px] text-slate-500 flex-shrink-0">
                          {doc.createdAt}
                        </span>
                        {doc.folderId &&
                          (() => {
                            const folder = folders.find((f) => f.id === doc.folderId);
                            return folder ? (
                              <span className="text-[10px] text-indigo-300 truncate flex items-center gap-0.5">
                                <Folder className="w-2.5 h-2.5 flex-shrink-0" />
                                <span className="truncate">{folder.name}</span>
                              </span>
                            ) : null;
                          })()}
                      </div>

                      {/* 3-dots Menu */}
                      <div className="relative flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderMenuOpenDocId(null);
                            setMenuOpenDocId(
                              menuOpenDocId === doc.id ? null : doc.id
                            );
                          }}
                          className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-[#1c202c] transition-colors"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {menuOpenDocId === doc.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 bottom-full mb-1 w-40 bg-[#181a24] border border-[#292e3f] rounded-lg shadow-xl py-1 z-30 text-xs"
                          >
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setFolderMenuOpenDocId(
                                    folderMenuOpenDocId === doc.id ? null : doc.id
                                  )
                                }
                                className="w-full text-left px-3 py-1.5 text-slate-300 hover:bg-[#202434] flex items-center justify-between gap-1.5"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Folder className="w-3 h-3" />
                                  <span>폴더 이동</span>
                                </span>
                                <ChevronRight className="w-3 h-3 text-slate-500" />
                              </button>

                              {folderMenuOpenDocId === doc.id && (
                                <div className="absolute right-full top-0 mr-1 w-36 bg-[#181a24] border border-[#292e3f] rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveDocToFolder(doc.id, null)}
                                    className={`w-full text-left px-3 py-1.5 hover:bg-[#202434] ${
                                      !doc.folderId ? "text-indigo-300" : "text-slate-300"
                                    }`}
                                  >
                                    미분류
                                  </button>
                                  {folders.length === 0 ? (
                                    <div className="px-3 py-1.5 text-slate-600">
                                      폴더 없음
                                    </div>
                                  ) : (
                                    folders.map((folder) => (
                                      <button
                                        key={folder.id}
                                        type="button"
                                        onClick={() =>
                                          handleMoveDocToFolder(doc.id, folder.id)
                                        }
                                        className={`w-full text-left px-3 py-1.5 hover:bg-[#202434] truncate ${
                                          doc.folderId === folder.id
                                            ? "text-indigo-300"
                                            : "text-slate-300"
                                        }`}
                                      >
                                        {folder.name}
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteDoc(doc.id, e)}
                              className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-[#202434] flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>삭제</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>
        ) : (
          /* ========================================================
             VIEW B: 문서 상세 뷰어 (Document Workspace)
             ======================================================== */
          activeDoc && (
            <main className="p-6 sm:p-8 max-w-[1600px] mx-auto w-full">
              {/* Workspace Top Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#202433] mb-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setView("library");
                      setActiveDocId(null);
                    }}
                    className="p-1.5 rounded-lg border border-[#262b3a] bg-[#14161f] text-slate-400 hover:text-white hover:bg-[#1c202c] transition-all flex items-center gap-1 text-xs"
                    title="문서 목록으로 돌아가기"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>문서</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white truncate max-w-md">
                      {activeDoc.title}
                    </h2>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#1e2333] text-[#7888ab] border border-[#2b3248]">
                      {activeDoc.fileType}
                    </span>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#272b3a] bg-[#14161f] hover:bg-[#1c202d] text-slate-300 text-xs transition-colors"
                  >
                    {isCopied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">
                          복사 완료
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>복사</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSummary}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#272b3a] bg-[#14161f] hover:bg-[#1c202d] text-slate-300 text-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>.md</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteDoc(activeDoc.id, e)}
                    className="p-1.5 rounded-lg border border-[#272b3a] bg-[#14161f] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors"
                    title="문서 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Split Workspace: 좌측 원본 뷰어 / 우측 요약·퀴즈 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left: 원본 파일 뷰어 */}
                <div className="lg:sticky lg:top-6 h-[70vh] lg:h-[calc(100vh-8rem)]">
                  <OriginalDocViewer
                    pdfBlob={viewerPdfBlob}
                    originalBlob={viewerOriginalBlob}
                    isLoadingBlob={isLoadingBlob}
                    fileType={activeDoc.fileType}
                    fileName={activeDoc.fileName}
                    targetPage={targetPage}
                  />
                </div>

                {/* Right: 요약 / 퀴즈 */}
                <div className="min-w-0">
                  {/* Tabs */}
                  <div className="flex border-b border-[#202433] mb-6 gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab("summary")}
                      className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === "summary"
                          ? "border-indigo-500 text-white"
                          : "border-transparent text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>시험 대비 요약</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("quiz")}
                      className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === "quiz"
                          ? "border-indigo-500 text-white"
                          : "border-transparent text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>실전 모의 퀴즈</span>
                    </button>
                  </div>

                  {/* Tab Content */}
                  {activeTab === "summary" ? (
                <div className="bg-[#12141d] border border-[#202433] rounded-xl p-6 sm:p-8">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ node, children, ...props }) => (
                        <h1
                          className="text-xl sm:text-2xl font-bold text-white mt-6 mb-3 pb-2 border-b border-[#232736]"
                          {...props}
                        >
                          {renderWithPageCitations(children)}
                        </h1>
                      ),
                      h2: ({ node, children, ...props }) => (
                        <h2
                          className="text-lg sm:text-xl font-bold text-white mt-5 mb-2.5 pb-1 border-b border-[#232736]"
                          {...props}
                        >
                          {renderWithPageCitations(children)}
                        </h2>
                      ),
                      h3: ({ node, children, ...props }) => (
                        <h3
                          className="text-sm sm:text-base font-bold text-slate-100 bg-[#191d29] border-l-2 border-indigo-500 px-3.5 py-2 my-4 rounded-r"
                          {...props}
                        >
                          {renderWithPageCitations(children)}
                        </h3>
                      ),
                      h4: ({ node, children, ...props }) => (
                        <h4
                          className="text-xs sm:text-sm font-semibold text-slate-200 mt-4 mb-1.5"
                          {...props}
                        >
                          {renderWithPageCitations(children)}
                        </h4>
                      ),
                      p: ({ node, children, ...props }) => (
                        <p
                          className="my-2.5 text-slate-300 leading-relaxed text-xs sm:text-sm"
                          {...props}
                        >
                          {renderWithPageCitations(children)}
                        </p>
                      ),
                      ul: ({ node, ...props }) => (
                        <ul
                          className="list-disc pl-5 my-2.5 space-y-1 text-slate-300 text-xs sm:text-sm"
                          {...props}
                        />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol
                          className="list-decimal pl-5 my-2.5 space-y-1 text-slate-300 text-xs sm:text-sm"
                          {...props}
                        />
                      ),
                      li: ({ node, children, ...props }) => (
                        <li className="leading-relaxed" {...props}>
                          {renderWithPageCitations(children)}
                        </li>
                      ),
                      blockquote: ({ node, children, ...props }) => (
                        <blockquote
                          className="border-l-2 border-indigo-500 bg-[#161a25] px-3.5 py-2.5 my-3 rounded-r text-slate-200 text-xs sm:text-sm"
                          {...props}
                        >
                          {renderWithPageCitations(children)}
                        </blockquote>
                      ),
                      strong: ({ node, children, ...props }) => (
                        <strong
                          className="font-semibold text-slate-100 bg-[#212638] px-1 py-0.5 rounded text-[0.95em]"
                          {...props}
                        >
                          {renderWithPageCitations(children)}
                        </strong>
                      ),
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4 border border-[#232736] rounded-lg bg-[#0e1017]">
                          <table
                            className="min-w-full divide-y divide-[#232736] text-xs"
                            {...props}
                          />
                        </div>
                      ),
                      thead: ({ node, ...props }) => (
                        <thead className="bg-[#181c28]" {...props} />
                      ),
                      th: ({ node, ...props }) => (
                        <th
                          className="px-3.5 py-2.5 text-left font-medium text-slate-300 border-r border-[#232736] last:border-r-0"
                          {...props}
                        />
                      ),
                      tbody: ({ node, ...props }) => (
                        <tbody
                          className="divide-y divide-[#1e2230] bg-[#10121a]"
                          {...props}
                        />
                      ),
                      tr: ({ node, ...props }) => (
                        <tr
                          className="hover:bg-[#161a24] transition-colors"
                          {...props}
                        />
                      ),
                      td: ({ node, children, ...props }) => (
                        <td
                          className="px-3.5 py-2 text-slate-300 border-r border-[#1e2230] last:border-r-0 leading-relaxed"
                          {...props}
                        >
                          {renderWithPageCitations(children)}
                        </td>
                      ),
                      code: ({ node, className, children, ...props }) => (
                        <code
                          className="bg-[#181a24] text-slate-300 text-[11px] px-1.5 py-0.5 rounded font-mono border border-[#262b3a]"
                          {...props}
                        >
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {activeDoc.summary}
                  </ReactMarkdown>
                </div>
              ) : (
                    <div>
                      <QuizSection
                        sourceText={activeDoc.summary}
                        fileName={activeDoc.fileName}
                        initialQuiz={activeDoc.quiz}
                        onSaveQuiz={(q) => handleSaveQuizToDoc(activeDoc.id, q)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </main>
          )
        )}
      </div>

      {/* 3. Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#14161f] border border-[#272c3d] rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#232736] mb-5">
              <h3 className="text-sm font-bold text-white">
                새 강의자료 업로드 및 분석
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (!isUploading) {
                    setIsUploadModalOpen(false);
                    setUploadFile(null);
                    setUploadError(null);
                  }
                }}
                disabled={isUploading}
                className="p-1 text-slate-500 hover:text-slate-300 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-[#2b3144] hover:border-slate-400 bg-[#0e1017] hover:bg-[#12141e] rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pptx,.pdf,.docx"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-full bg-[#1a1e2c] border border-[#292f44] flex items-center justify-center text-slate-400 mb-3">
                <UploadCloud className="w-6 h-6 text-indigo-400" />
              </div>

              <p className="text-xs font-semibold text-slate-200">
                파일을 끌어다 놓거나 클릭하여 선택
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                PPTX, PDF, DOCX (슬라이드 번호 및 페이지 자동 분석)
              </p>
            </div>

            {/* Selected File */}
            {uploadFile && (
              <div className="mt-4 p-3 rounded-lg bg-[#181a26] border border-[#262b3d] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span className="text-slate-200 truncate font-medium">
                    {uploadFile.name}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 flex-shrink-0">
                  {(uploadFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs">
                {uploadError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadFile(null);
                  setUploadError(null);
                }}
                className="px-4 py-2 rounded-lg border border-[#262b3a] bg-[#14161f] text-slate-400 text-xs font-medium hover:bg-[#1a1d28] transition-colors"
              >
                취소
              </button>

              <button
                type="button"
                disabled={!uploadFile || isUploading}
                onClick={handleStartSummarize}
                className={`px-5 py-2 rounded-lg font-medium text-xs transition-all flex items-center gap-2 ${
                  !uploadFile || isUploading
                    ? "bg-[#252a3a] text-slate-500 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow"
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{uploadStep || "분석 중..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>요약 및 보관하기</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
