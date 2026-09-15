import type { GoogleGenAI } from "@google/genai";

interface GeminiErrorInfo {
  isRateLimited: boolean;
  isDailyQuotaExceeded: boolean;
  retryDelayMs: number | null;
}

// Gemini SDK가 던지는 에러의 message에는 REST API의 JSON 에러 본문이
// 그대로 문자열로 들어있는 경우가 많다 (429 RESOURCE_EXHAUSTED 등).
export function parseGeminiError(error: unknown): GeminiErrorInfo {
  const message = error instanceof Error ? error.message : String(error);
  let isRateLimited = false;
  let isDailyQuotaExceeded = false;
  let retryDelayMs: number | null = null;

  const jsonMatch = message.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const err = parsed.error ?? parsed;
      if (err.code === 429 || err.status === "RESOURCE_EXHAUSTED") {
        isRateLimited = true;

        const details = Array.isArray(err.details) ? err.details : [];
        const quotaFailure = details.find((d: { ["@type"]?: string }) =>
          d?.["@type"]?.includes("QuotaFailure")
        );
        const violations = quotaFailure?.violations ?? [];
        if (
          violations.some((v: { quotaId?: string }) =>
            /PerDay/i.test(v?.quotaId || "")
          )
        ) {
          isDailyQuotaExceeded = true;
        }

        const retryInfo = details.find((d: { ["@type"]?: string }) =>
          d?.["@type"]?.includes("RetryInfo")
        );
        if (retryInfo?.retryDelay) {
          const seconds = parseFloat(String(retryInfo.retryDelay).replace("s", ""));
          if (!Number.isNaN(seconds)) retryDelayMs = Math.ceil(seconds * 1000);
        }
      }
    } catch {
      // JSON 파싱 실패 시 아래 텍스트 기반 판단으로 폴백
    }
  }

  if (!isRateLimited) {
    isRateLimited = /429|RESOURCE_EXHAUSTED|rate.?limit/i.test(message);
  }

  return { isRateLimited, isDailyQuotaExceeded, retryDelayMs };
}

// 사용자에게 보여줄 한국어 에러 메시지로 변환.
// 일일 할당량 초과는 재시도로 해결되지 않으므로 별도 안내.
export function toFriendlyGeminiErrorMessage(error: unknown): string {
  const info = parseGeminiError(error);
  if (info.isDailyQuotaExceeded) {
    return "Gemini API 무료 사용량(하루 요청 한도)을 모두 사용했습니다. 내일 다시 시도하거나 Google AI Studio에서 결제를 연결해 한도를 늘려주세요.";
  }
  if (info.isRateLimited) {
    return "요청이 몰려 Gemini API가 일시적으로 응답하지 않았습니다. 잠시 후 다시 시도해주세요.";
  }
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}

type GenerateContentParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];

// 일시적인 429(rate limit)에는 API가 알려준 재시도 대기시간(또는 지수 백오프)만큼
// 기다렸다가 자동으로 재시도한다. 하루 할당량 초과처럼 재시도해도 소용없는
// 에러는 즉시 그대로 던진다.
export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: GenerateContentParams,
  maxRetries = 3
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error) {
      lastError = error;
      const info = parseGeminiError(error);
      if (!info.isRateLimited || info.isDailyQuotaExceeded || attempt === maxRetries) {
        throw error;
      }
      const waitMs = info.retryDelayMs ?? Math.min(2000 * 2 ** attempt, 15000);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}
