# 📋 프로젝트 인계 문서 (Project Handover for Claude)

## 1. 프로젝트 개요
- **프로젝트명**: 대학 강의자료 시험 대비 요약기 & 실전 퀴즈 시스템 (UnivAI 스타일 문서 보관함)
- **로컬 디렉터리 경로**: `C:\Users\jmt56\.gemini\antigravity\scratch\lecture-summarizer`
- **실행 포트**: `http://localhost:3000` (`npm run dev`)

---

## 2. 기술 스택
- **Framework**: Next.js 14.2.15 (App Router, TypeScript)
- **Styling**: Tailwind CSS (다크 매트 모노크롬 테마), `@tailwindcss/typography`
- **AI SDK**: `@google/genai` (모델: `gemini-3.6-flash`, `.env.local`의 `GEMINI_API_KEY` 사용)
- **Document Parsing**: `officeparser` 7.8.x (PPTX, PDF, DOCX 버퍼 파싱 및 슬라이드/페이지 AST 추출)
- **Markdown & Icons**: `react-markdown`, `remark-gfm`, `lucide-react`

---

## 3. 핵심 아키텍처 및 구현된 기능
1. **문서 보관함 (Library View)**:
   - `localStorage` 기반 영구 저장 (`saved_documents` 키)
   - UnivAI 레퍼런스 스타일의 매트 다크 그리드 UI
   - `+ 새로 만들기` 카드 (업로드 팝업) + 등록된 문서 카드 (썸네일 배너, 형식 배지, 날짜, 삭제 메뉴)
2. **문서 뷰어 & 워크스페이스 (Workspace View)**:
   - 상단 내비게이션 (`← 문서 목록` 복귀, 복사, `.md` 다운로드, 삭제)
   - **탭 1: 시험 대비 요약**:
     - 원본 슬라이드/페이지 AST를 파싱하여 문장마다 `p.06` 출처 배지 표기
     - 슬라이드 순서 정리, 비교 표, 인과관계(`A → B`), 핵심 블록쿼트(`>`), 섹션별 쉬운 설명
   - **탭 2: 실전 모의 퀴즈**:
     - 한국어/영어(KO/EN) 지원
     - 3문제 / 5문제 / 10문제 문항 수 조절
     - 하(기초) / 중(응용) / 상(심화) 3단계 난이도
     - 4지선다 인터랙티브 풀이, 실시간 채점, 정/오답 시각화, 상세 해설, 퀴즈 `.md` 다운로드
     - 출제된 퀴즈는 해당 문서 데이터에 자동 저장

---

## 4. 주요 파일 구조
```
lecture-summarizer/
├── app/
│   ├── api/
│   │   ├── summarize/route.ts   # officeparser 슬라이드/페이지 추출, Gemini 3.6 Flash 요약 (15000자 분기: 단일/Map-Reduce)
│   │   └── quiz/route.ts        # Gemini 3.6 Flash JSON 스키마 기반 4지선다 퀴즈 출제 API
│   ├── globals.css              # 매트 다크(#0c0d11) 배경 및 커스텀 스크롤바
│   ├── layout.tsx               # 루트 레이아웃 (dark 기본 설정)
│   └── page.tsx                 # 문서 보관함 그리드 + 뷰어 워크스페이스 + 업로드 모달 통합
├── components/
│   └── QuizSection.tsx          # 미니멀 다크 모의 퀴즈 인터랙티브 플레이어
├── .env.local                   # GEMINI_API_KEY 설정 파일
├── .env.local.example           # 환경 변수 템플릿
├── next.config.mjs              # officeparser 서버 모듈 설정
├── tailwind.config.js           # Tailwind CommonJS 설정
├── postcss.config.js            # PostCSS CommonJS 설정
└── package.json
```
