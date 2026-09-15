"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Download,
  Lightbulb,
  Globe,
  Sliders,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { QuizResponse } from "@/app/api/quiz/route";

interface QuizSectionProps {
  sourceText: string;
  fileName: string;
  initialQuiz?: QuizResponse | null;
  onSaveQuiz?: (quiz: QuizResponse) => void;
}

export default function QuizSection({
  sourceText,
  fileName,
  initialQuiz,
  onSaveQuiz,
}: QuizSectionProps) {
  // 퀴즈 생성 옵션
  const [language, setLanguage] = useState<"ko" | "en">("ko");
  const [count, setCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  // 상태
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizResponse | null>(initialQuiz || null);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [showStudyMode, setShowStudyMode] = useState<boolean>(false);

  const handleGenerateQuiz = async () => {
    if (!sourceText.trim()) {
      setError("퀴즈를 생성할 강의자료 텍스트가 없습니다.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setUserAnswers({});
    setIsSubmitted(false);
    setShowStudyMode(false);

    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText,
          language,
          count,
          difficulty,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "퀴즈 생성에 실패했습니다.");
      }

      setQuiz(data);
      if (onSaveQuiz) {
        onSaveQuiz(data);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "퀴즈 생성 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOption = (questionIndex: number, optionIndex: number) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const handleGradeQuiz = () => {
    if (!quiz) return;
    const answeredCount = Object.keys(userAnswers).length;
    if (answeredCount < quiz.questions.length) {
      const unanswered = quiz.questions.length - answeredCount;
      if (
        !window.confirm(
          `아직 풀지 않은 문제가 ${unanswered}개 있습니다. 그래도 채점하시겠습니까?`
        )
      ) {
        return;
      }
    }
    setIsSubmitted(true);
  };

  const handleReset = () => {
    setUserAnswers({});
    setIsSubmitted(false);
    setShowStudyMode(false);
  };

  const calculateScore = () => {
    if (!quiz) return { correct: 0, total: 0, percentage: 0 };
    let correct = 0;
    quiz.questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.answer) {
        correct++;
      }
    });
    const total = quiz.questions.length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correct, total, percentage };
  };

  const score = calculateScore();

  const handleDownloadQuiz = () => {
    if (!quiz) return;
    let md = `# 📝 ${quiz.title}\n`;
    md += `> 파일명: ${fileName} | 난이도: ${
      difficulty === "easy" ? "하" : difficulty === "hard" ? "상" : "중"
    } | 언어: ${language.toUpperCase()}\n\n---\n\n`;

    quiz.questions.forEach((q, idx) => {
      md += `### Q${idx + 1}. ${q.question}\n\n`;
      q.options.forEach((opt, optIdx) => {
        const marker = ["A", "B", "C", "D"][optIdx];
        md += `- (${marker}) ${opt}\n`;
      });
      md += `\n> **정답**: (${["A", "B", "C", "D"][q.answer]}) ${q.options[q.answer]}\n`;
      md += `> **해설**: ${q.explanation}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName.replace(/\.[^/.]+$/, "")}-시험퀴즈.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Quiz Configuration Panel */}
      <div className="bg-[#14161f] border border-[#232735] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            모의 퀴즈 설정
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. 언어 선택 */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>출제 언어</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLanguage("ko")}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                  language === "ko"
                    ? "bg-[#252a3a] text-white border-indigo-500/80 shadow-sm"
                    : "bg-[#181a24] text-slate-400 border-[#262a38] hover:text-slate-200"
                }`}
              >
                한국어
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                  language === "en"
                    ? "bg-[#252a3a] text-white border-indigo-500/80 shadow-sm"
                    : "bg-[#181a24] text-slate-400 border-[#262a38] hover:text-slate-200"
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* 2. 문제 개수 */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              문제 수
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[3, 5, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCount(num)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                    count === num
                      ? "bg-[#252a3a] text-white border-indigo-500/80 shadow-sm"
                      : "bg-[#181a24] text-slate-400 border-[#262a38] hover:text-slate-200"
                  }`}
                >
                  {num}문제
                </button>
              ))}
            </div>
          </div>

          {/* 3. 난이도 */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              난이도
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDifficulty("easy")}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all text-center ${
                  difficulty === "easy"
                    ? "bg-[#252a3a] text-emerald-400 border-emerald-500/60 shadow-sm"
                    : "bg-[#181a24] text-slate-400 border-[#262a38] hover:text-slate-200"
                }`}
              >
                하 (기초)
              </button>
              <button
                type="button"
                onClick={() => setDifficulty("medium")}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all text-center ${
                  difficulty === "medium"
                    ? "bg-[#252a3a] text-amber-300 border-amber-500/60 shadow-sm"
                    : "bg-[#181a24] text-slate-400 border-[#262a38] hover:text-slate-200"
                }`}
              >
                중 (응용)
              </button>
              <button
                type="button"
                onClick={() => setDifficulty("hard")}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all text-center ${
                  difficulty === "hard"
                    ? "bg-[#252a3a] text-rose-400 border-rose-500/60 shadow-sm"
                    : "bg-[#181a24] text-slate-400 border-[#262a38] hover:text-slate-200"
                }`}
              >
                상 (심화)
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleGenerateQuiz}
            disabled={isLoading}
            className={`px-5 py-2 rounded-lg font-medium text-xs shadow transition-all flex items-center justify-center gap-2 ${
              isLoading
                ? "bg-[#252a38] text-slate-500 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-500 text-white active:scale-[0.98]"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>퀴즈 출제 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{quiz ? "퀴즈 새로 출제" : "퀴즈 출제하기"}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-center gap-2">
          <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quiz List */}
      {quiz && quiz.questions && quiz.questions.length > 0 && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#232735]">
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-semibold text-slate-200">
                {quiz.title}
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded bg-[#1f2330] text-slate-400 border border-[#2b3042]">
                {quiz.questions.length}문항
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowStudyMode((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#272b3a] bg-[#14161f] hover:bg-[#1c202d] text-slate-400 text-xs transition-colors"
              >
                {showStudyMode ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>학습 모드 끄기</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>해설 미리보기</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadQuiz}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#191d29] border border-[#282d3e] text-slate-300 text-xs hover:bg-[#202534] transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>다운로드</span>
              </button>
            </div>
          </div>

          {/* Question Cards */}
          <div className="space-y-3.5">
            {quiz.questions.map((q, qIndex) => {
              const selectedOpt = userAnswers[qIndex];
              const isAnswered = selectedOpt !== undefined;
              const isCorrect = isAnswered && selectedOpt === q.answer;
              const showResult = isSubmitted || showStudyMode;

              return (
                <div
                  key={q.id || qIndex}
                  className={`border rounded-xl p-4 transition-all ${
                    showResult
                      ? isCorrect
                        ? "bg-[#141d1a] border-emerald-900/60"
                        : isAnswered
                        ? "bg-[#201519] border-rose-900/60"
                        : "bg-[#14161f] border-[#232735]"
                      : "bg-[#14161f] border-[#232735]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[#232839] text-slate-300 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                        {qIndex + 1}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-100">
                        {q.question}
                      </h4>
                    </div>

                    {showResult && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                          isCorrect
                            ? "text-emerald-400 bg-emerald-950/60 border border-emerald-900/60"
                            : isAnswered
                            ? "text-rose-400 bg-rose-950/60 border border-rose-900/60"
                            : "text-slate-500 bg-[#1e2230]"
                        }`}
                      >
                        {isCorrect ? "정답" : isAnswered ? "오답" : "미응답"}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 my-2">
                    {q.options.map((optionText, optIndex) => {
                      const isSelected = selectedOpt === optIndex;
                      const isCorrectAnswer = optIndex === q.answer;

                      let optionStyle =
                        "border-[#262b3a] bg-[#10121a] hover:bg-[#191c28] text-slate-300";

                      if (showResult) {
                        if (isCorrectAnswer) {
                          optionStyle =
                            "border-emerald-600/80 bg-emerald-950/40 text-emerald-200 font-medium";
                        } else if (isSelected && !isCorrectAnswer) {
                          optionStyle =
                            "border-rose-700/60 bg-rose-950/40 text-rose-300 line-through opacity-70";
                        } else {
                          optionStyle = "border-[#202432] bg-[#0e1017] text-slate-500 opacity-60";
                        }
                      } else if (isSelected) {
                        optionStyle =
                          "border-indigo-500/80 bg-indigo-950/40 text-white font-medium";
                      }

                      const optionLabel = ["A", "B", "C", "D"][optIndex] || String(optIndex + 1);

                      return (
                        <button
                          key={optIndex}
                          type="button"
                          disabled={isSubmitted}
                          onClick={() => handleSelectOption(qIndex, optIndex)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs flex items-center gap-2.5 transition-all ${optionStyle} ${
                            isSubmitted ? "cursor-default" : "cursor-pointer"
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-semibold flex-shrink-0 border ${
                              showResult && isCorrectAnswer
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : isSelected
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-[#181b26] border-[#292e3e] text-slate-400"
                            }`}
                          >
                            {optionLabel}
                          </span>
                          <span className="flex-1 leading-relaxed">{optionText}</span>
                        </button>
                      );
                    })}
                  </div>

                  {showResult && (
                    <div className="mt-3 p-3 rounded-lg bg-[#0e1017] border border-[#232735] text-xs text-slate-300 leading-relaxed">
                      <div className="flex items-center gap-1.5 font-medium text-slate-200 mb-1">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span>해설</span>
                      </div>
                      <p className="text-slate-400 whitespace-pre-wrap">{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Bar */}
          <div className="p-4 rounded-xl bg-[#14161f] border border-[#232735] flex items-center justify-between">
            {!isSubmitted ? (
              <>
                <div className="text-xs text-slate-400">
                  {Object.keys(userAnswers).length} / {quiz.questions.length} 문제 완료
                </div>

                <button
                  type="button"
                  onClick={handleGradeQuiz}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>채점하기</span>
                </button>
              </>
            ) : (
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white">
                    {score.correct} / {score.total} 정답 ({score.percentage}%)
                  </span>
                  <span className="text-xs text-slate-400">
                    {score.percentage >= 80 ? "합격 수준" : "추가 복습 권장"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-lg border border-[#2b3042] bg-[#181a24] hover:bg-[#202534] text-slate-300 text-xs transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>다시 풀기</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
