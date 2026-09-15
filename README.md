# 대학 강의자료 시험 대비 요약기 (Lecture Exam Summarizer)

대학 강의자료(PPTX, PDF, DOCX)를 업로드하면 텍스트를 추출하고, Google Gemini 2.5 Flash 모델을 활용하여 시험 대비 맞춤형 요약본을 자동 생성하는 Next.js 웹 애플리케이션입니다.

---

## 🛠️ 주요 기능

1. **강의자료 텍스트 추출**: `officeparser`를 통해 `.pptx`, `.pdf`, `.docx` 형식의 파일에서 텍스트를 고속 추출
2. **지능형 요약 처리 (15,000자 기준 자동 분기)**:
   - **15,000자 이하**: 단일 API 호출로 신속하고 일관성 있는 시험 요약 생성
   - **15,000자 초과**: 문맥 기반 청크 분할 후 **Map-Reduce** 방식으로 대용량 강의자료 누락 없이 통합 요약
3. **시험 대비 특화 시스템 프롬프트 적용**:
   - 전체 개요 문단 (**핵심 용어 볼드**)
   - 슬라이드 순서 기반 `### N. 소제목` 구성
   - 개념 정의 불릿, 비교 마크다운 표, 인과관계(`A → B`), `> 블록쿼트` 강조
   - 섹션별 일상 비유 중심의 **"쉬운 설명"** 포함
4. **리치 마크다운 렌더링 UI**:
   - `react-markdown` + `remark-gfm` 기반
   - 표, 인용구, 볼드 하이라이트 맞춤 스타일링
   - 원클릭 마크다운 복사 및 `.md` 파일 다운로드 지원
5. **예외 및 오류 처리**:
   - 빈 파일 또는 텍스트 미추출 시 **422 Unprocessable Entity** 처리 및 사용자 친화적 에러 메시지 제공

---

## 📁 프로젝트 구조

```
lecture-summarizer/
├── app/
│   ├── api/
│   │   └── summarize/
│   │       └── route.ts          # 파일 수신, officeparser 텍스트 추출, Gemini 요약 (단일/Map-Reduce)
│   ├── globals.css               # Tailwind CSS 설정 및 마크다운 커스텀 렌더링 스타일
│   ├── layout.tsx                # 루트 레이아웃 (메타데이터, 폰트)
│   └── page.tsx                  # 메인 페이지 (파일 업로드 드롭존, 마크다운 뷰어, 유틸리티)
├── public/                       # 정적 에셋
├── .env.local                    # 로컬 환경 변수 (GEMINI_API_KEY)
├── .env.local.example            # 환경 변수 예시 템플릿
├── next.config.mjs               # Next.js 설정 (officeparser 외부 패키지 지정)
├── package.json                  # 프로젝트 종속성 및 스크립트
├── postcss.config.mjs            # PostCSS 설정
├── tailwind.config.ts            # Tailwind CSS 설정
└── tsconfig.json                 # TypeScript 설정
```

---

## 🚀 실행 방법

### 1. API 키 설정
프로젝트 루트의 `.env.local` 파일을 열고 발급받은 Google Gemini API 키를 입력합니다:

```env
GEMINI_API_KEY=AIzaSy...
```
> [Google AI Studio](https://aistudio.google.com/)에서 무료로 API 키를 발급받으실 수 있습니다.

### 2. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 강의자료 파일을 업로드하고 요약을 생성할 수 있습니다.

### 3. 프로덕션 빌드
```bash
npm run build
npm run start
```
