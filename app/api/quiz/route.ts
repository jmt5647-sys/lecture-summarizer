import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 120;

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.6-flash";

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number; // 0, 1, 2, 3
  explanation: string;
  difficulty: "하" | "중" | "상" | "Easy" | "Medium" | "Hard";
}

export interface QuizResponse {
  title: string;
  questions: QuizQuestion[];
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

    const body = await req.json();
    const { text, language = "ko", count = 5, difficulty = "medium" } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "퀴즈를 생성할 강의자료 내용이 없습니다." },
        { status: 400 }
      );
    }

    // 문제 개수 제한 (1 ~ 15개)
    const validCount = Math.min(Math.max(Number(count) || 5, 1), 15);
    const isKorean = language === "ko";

    // 난이도 설명 구성
    let difficultyGuide = "";
    if (difficulty === "easy") {
      difficultyGuide = isKorean
        ? "난이도 [하]: 강의자료에 등장하는 핵심 용어의 정의, 기본 개념, 주요 명칭의 일치 여부를 묻는 직관적인 문제 위주로 출제하세요."
        : "Difficulty [Easy]: Focus on core terminology definitions, basic concepts, and direct factual recall from the material.";
    } else if (difficulty === "hard") {
      difficultyGuide = isKorean
        ? "난이도 [상]: 복합 시나리오 적용, 두 가지 이상의 이론/개념 융합, 함정 선지(오답 매력도 높음), 반례 분석 등 깊이 있는 학술적 추론이 필요한 문제 위주로 출제하세요."
        : "Difficulty [Hard]: Focus on complex scenario applications, synthesizing multiple concepts, tricky plausible distractors, and in-depth analytical reasoning.";
    } else {
      difficultyGuide = isKorean
        ? "난이도 [중]: 개념 간 비교/차이점, 인과관계(A → B), 프레임워크 분류 체계를 올바르게 적용했는지 묻는 실전 시험형 문제 위주로 출제하세요."
        : "Difficulty [Medium]: Focus on comparing concepts, causal relationships (A → B), and applying framework classifications in real-world exam contexts.";
    }

    const prompt = isKorean
      ? `당신은 대학 시험 출제 위원장입니다. 제공된 강의자료 텍스트를 분석하여 학생들의 시험 대비를 위한 고품질 4지선다형 객관식 퀴즈를 정확히 ${validCount}문제 생성하세요.

[출제 가이드라인]
1. ${difficultyGuide}
2. 모든 문제는 4개의 매력적인 선택지(options, 정확히 4개)를 가져야 합니다.
3. 정답(answer)은 0부터 3까지의 정수 인덱스여야 합니다.
4. 해설(explanation)은 정답이 정답인 이유뿐만 아니라 다른 보기가 왜 틀렸는지 명확하고 교육적으로 설명하세요.
5. 모든 텍스트는 한국어로 작성하세요.

[출력 형식 - 반드시 유효한 JSON 객체로 응답]
{
  "title": "강의자료 핵심 시험 대비 퀴즈",
  "questions": [
    {
      "id": 1,
      "question": "문제 지문",
      "options": ["보기 1", "보기 2", "보기 3", "보기 4"],
      "answer": 0,
      "explanation": "상세 해설...",
      "difficulty": "${difficulty === "easy" ? "하" : difficulty === "hard" ? "상" : "중"}"
    }
  ]
}

[강의자료 내용]
${text.slice(0, 30000)}`
      : `You are a university examination board director. Analyze the provided lecture material and create exactly ${validCount} high-quality multiple-choice questions for students' exam preparation.

[Guidelines]
1. ${difficultyGuide}
2. Every question must have exactly 4 plausible options (options).
3. The answer (answer) must be an integer index from 0 to 3.
4. The explanation (explanation) must clearly justify the correct answer and explain why other choices are incorrect.
5. All text must be in English.

[Output Format - Must respond with valid JSON object]
{
  "title": "Lecture Exam Preparation Quiz",
  "questions": [
    {
      "id": 1,
      "question": "Question stem...",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "answer": 0,
      "explanation": "Detailed explanation...",
      "difficulty": "${difficulty === "easy" ? "Easy" : difficulty === "hard" ? "Hard" : "Medium"}"
    }
  ]
}

[Lecture Material Content]
${text.slice(0, 30000)}`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
    let quizData: QuizResponse;
    try {
      quizData = JSON.parse(responseText);
    } catch {
      // JSON 파싱 실패 시 백업 정규식 파싱
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        quizData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("AI가 유효한 JSON 형식의 퀴즈를 반환하지 못했습니다.");
      }
    }

    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      throw new Error("퀴즈 문제 목록이 올바르게 생성되지 않았습니다.");
    }

    return NextResponse.json(quizData);
  } catch (error: unknown) {
    console.error("Quiz generation error:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `퀴즈 생성 실패: ${message}` },
      { status: 500 }
    );
  }
}
