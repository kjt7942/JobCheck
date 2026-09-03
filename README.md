# JobCheck — 농장 일정 관리 웹앱

- **저장소**: https://github.com/kjt7942/JobCheck
- **한줄 설명**: 포도(샤인머스캣) 농장의 하루 할 일과 반복 농작업 일정을 기록·조회하고, 실시간 날씨·영수증 OCR·농약 희석 계산까지 지원하는 Next.js + Firebase 웹앱.

## 목적

농장업무를 체계적으로 관리하고, 매년 비슷하게 반복되는 농작업 일정을 참고하기 위함.

노션(Notion) DB로 시작했다가 실시간 동기화와 다중 이미지 첨부 요구가 커지면서 Firebase(Firestore + Storage)로 전면 이전했고, 이후 날씨 자동 수집·영수증 OCR·RBAC 등 실사용 과정에서 필요해진 기능을 계속 얹어왔다.

## 구현하려던 주요 기능

- **일정 관리 (일간/주간/월간/연간 뷰)**: `DailyView`, `MonthlyView`, `YearlyView` — 날짜별 할 일 등록/수정/삭제, 반복 일정(마스터+예외 처리), 완료 토글, 자주 쓰는 일정 스티커 추천(백그라운드 랭킹 집계), 입력창 자동완성(datalist)
- **모바일 제스처**: 일간 뷰 좌우 스와이프, 월간 달력 스와이프로 날짜/월 전환 (터치 + PC 마우스 드래그 겸용)
- **실시간 날씨 연동**: 기상청 공식 API 기반 자동 수집(`api/cron/weather`), 일정별 수동 입력값과 자동 수집 캐시(`dailyWeather`) 간 폴백 체계
- **기록부(FarmRecordsView) + 영수증 OCR**: 영수증/명세서 이미지를 Gemini Vision으로 인식해 날짜·분류·금액·메모 자동 입력, 인식 결과 확인 모달(전체화면 이미지 뷰어) 후 저장
- **다중 이미지 업로드**: 무제한 다중 이미지 첨부, 클라이언트 압축(800px), 스켈레톤 UI, 모달 이미지 뷰어(스와이프/터치 영역 정밀 튜닝)
- **영농 도구함(ToolsView)**: 농약 희석 계산기, 결로 예방 이슬점 계산, 수확 포장 계산기
- **영농 개선 노트(NotesArchiveView)**: 오답노트 성격의 피드백 기록 아카이브
- **RBAC / 인증**: 관리자 승인 기반 사용자 관리, 권한별 기능 제어, 읽지 않은 알림, 로그인 화면(`LoginView`), 앱 비밀번호(`APP_PASSWORD`) 보호
- **PWA**: `manifest.json` + 아이콘, 홈 화면 설치 지원
- **다크모드 + 반응형**: 전체 화면 테마 시스템, 모바일/PC 레이아웃 최적화

## 화면 흐름 / 아키텍처

```
src/
├─ app/               # Next.js App Router 진입점 + API 라우트
│  ├─ api/weather, api/cron/weather   # 날씨 수집/조회
│  └─ api/receipt-ocr                 # Gemini 영수증 OCR
├─ components/        # DailyView / MonthlyView / YearlyView / FarmRecordsView /
│                      # ToolsView / NotesArchiveView / LoginView / SettingsModal 등 UI
├─ providers/          # AppProvider — 전역 상태(로그인, 일정, 날씨 캐시) 공급
├─ services/           # jobService / authService / adminService / farmRecordService / sprayService
├─ repo/               # firestoreRepository — Firestore 데이터 접근 계층
├─ lib/                # firebase(client)/firebase-admin, weather, gemini, sprayWarning
├─ types/              # 도메인 타입
└─ utils/              # imageUtils 등
```

`AGENTS.md`에 정의된 계층 규칙(`Types → Config → Repo → Service → Runtime(Providers) → UI`)을 따르며, 상위 계층에서 하위 계층만 참조한다.

## 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 16 (App Router) | Vercel 배포 최적화 |
| 언어 | TypeScript | |
| UI | React 19, Tailwind CSS 4 | |
| 데이터베이스 | Firebase Firestore + Storage | 최초엔 Notion API였다가 실시간 동기화/이미지 요구로 이전 |
| 인증 | Firebase Auth 기반 자체 RBAC | `authService`, `adminService` |
| 날씨 | 기상청 공식 API | 이전엔 네이버 날씨 파싱(정규식) → 안정성 문제로 공식 API 전환 |
| OCR | Google Gemini (Vision) | 모델 우선순위 폴백: `gemini-flash-lite-latest` → `gemini-flash-latest` → `gemini-3.1-flash-lite` |
| 날짜 처리 | date-fns | |
| 아이콘 | lucide-react | |
| 배포 | Vercel | GitHub `main` 브랜치 push 시 자동 배포 |

## 요구 사항 / 빌드 방법

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

Firebase / Notion(레거시) / 기상청 / Gemini 관련 환경 변수(`NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `KMA_AUTH_KEY`, `GEMINI_API_KEY`, `APP_PASSWORD` 등)가 필요하며, 실제 값은 `.env.local`(git 미포함)에 보관한다.

## 개발 기록

| 시기 | 작업 |
|---|---|
| 2026-04-18 | Next.js + Notion API 기반 초기 빌드, 동적 속성 탐색 로직, 대시보드 UI |
| 2026-04-19 | 수동 날씨/기온 입력, 일정 삭제 확인 모달 |
| 2026-04-20 ~ 04-22 | 비밀번호 보호, PWA 지원(manifest/아이콘), 테마 시스템 및 UI/UX 전면 최적화 |
| 2026-04-23 | **Firebase(Firestore) 마이그레이션** — 실시간 업데이트, 전체 일정 공유, 빌드 안정화 |
| 2026-04-23 ~ 04-27 | 다중 이미지 업로드/압축/스켈레톤 UI, 이미지 뷰어 스와이프/터치 영역 정밀 튜닝, 연간 뷰 월별 상세 리스트 |
| 2026-05-31 ~ 06-01 | 네이버 실시간 날씨 파싱 엔진, 주간 일정 세로 타임라인 → 이후 영농 도구함(농약 희석/이슬점/포장 계산기)으로 대체, 일간/월간 스와이프 제스처, 연간 뷰 연도 네비게이션 |
| 2026-06-01 | 네이버 날씨 정규식 오류 수정 → **기상 파싱 실패 시 거짓 기본값 대신 정직하게 에러 리포팅**하도록 구조 교정, API 캐시 해제(`no-store`, `force-dynamic`) |
| 2026-06-05 ~ 07-05 | 날씨 아이콘 토글, 영농 개선 노트(오답노트) 신설 및 문구 정비, 자주 쓰는 일정 추천 스티커(백그라운드 집계+캐시), 입력 자동완성 |
| 2026-07-29 | **기상청 공식 API로 전환**(네이버 파싱 폐기), 반복일정/보안 버그 수정 |
| 2026-08-17 | Firebase Storage 보안 규칙 추가, 반복일정 삭제 중복 클릭 방지, 날씨 크론 KST 날짜 버그 수정, 코드리뷰 지적사항 반영 |
| 2026-08-19 | 반복일정 중간 규칙 변경, **기록부(영수증 이미지 첨부)** 기능 추가, 날씨 폴백 표시 개선 |
| 2026-08-20 | **영수증 Gemini OCR 자동입력**, 인식 결과 확인 모달(전체화면 이미지 뷰어), 중복 저장 버그 수정 |

## 스크린샷 / 데모

_(자리만 확보 — 캡처 준비되면 `public/screenshots/`에 넣고 아래 표에 연결)_

| 화면 | 스크린샷 |
|---|---|
| 일간 할 일 | _(예정)_ |
| 월간 달력 | _(예정)_ |
| 기록부 / 영수증 OCR | _(예정)_ |

## 트러블슈팅 · 배운 점

- **날씨 파싱이 조용히 틀린 값을 주던 문제**: 초기엔 네이버 날씨 페이지를 정규식으로 파싱했는데, 정규식 에러(비표준 대괄호)와 파싱 실패 시 디폴트 기온으로 대체하던 로직이 "실패를 숨기고 거짓 데이터를 보여주는" 결과를 낳았다. → 파싱 실패 시 `success: false`로 정직하게 에러를 리포팅하도록 구조를 바꾸고(커밋 `a089eda`), 이후 아예 기상청 공식 API로 전환했다(`2d8c862`).
- **날씨 캐시로 인한 지연 반영**: 날씨 API 응답을 30분 캐시하다 보니 실시간성이 떨어져 `cache: no-store` + `force-dynamic` 선언으로 즉시 조회를 보장했다(`c86a602`).
- **반복 일정 삭제 시 중복 클릭**: Firestore 왕복 대기 중 같은 항목을 여러 번 클릭하면 중복 삭제 요청이 나가던 문제 → 요청 전 로컬에서 즉시 숨김 처리(`pendingCancelIds`)로 방어 (`DailyView.tsx`, `MonthlyView.tsx`).
- **날씨 크론의 KST 날짜 버그**: 서버 UTC 기준 날짜와 한국 시간 기준 날짜가 어긋나던 문제를 수정(`b68f1b6`).
- **RBAC 도입 후 레거시 데이터 크래시**: 기존 사용자 데이터에 새 권한 필드가 없어 사용자 관리 화면이 크래시 → 누락 필드 방어 처리(`2ae3dac`).
- **이미지 모달 깜빡임/터치 영역**: `key` prop으로 인한 리마운트가 전환 시 플래시를 유발 → key 제거 및 트랜지션 최적화, 터치 존을 여러 차례 정밀 튜닝(`Zone 4/6` 등)해서 스와이프 오작동을 줄였다.

## 향후 계획

- 오프라인 모드 지원 (PWA 로컬 캐싱 강화) — 초기 기획부터 미완
- 푸시 알림 서비스 (중요 일정/반복 작업 알림)
- 농장 운영 통계 리포트 (월별/연별 작업 시간·빈도 시각화)
