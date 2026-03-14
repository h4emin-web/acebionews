<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-2.95-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
</p>

<h1 align="center">💊 AceBioNews</h1>

<p align="center">
  <b>바이오·제약 산업 뉴스 통합 인텔리전스 플랫폼</b><br/>
  국내외 제약·바이오 뉴스, 규제 동향, 특허 만료, 임상시험, 빅딜 정보를 <br/>
  실시간으로 수집·분석·요약하여 한눈에 제공합니다.
</p>

<p align="center">
  <a href="#-주요-기능">주요 기능</a> •
  <a href="#%EF%B8%8F-시스템-아키텍처">아키텍처</a> •
  <a href="#-기술-스택">기술 스택</a> •
  <a href="#-시작하기">시작하기</a> •
  <a href="#-프로젝트-구조">프로젝트 구조</a> •
  <a href="#-데이터-파이프라인">데이터 파이프라인</a>
</p>

---

##  주요 기능

| 기능 | 설명 |
|:---|:---|
|  **뉴스 자동 수집** | 국내(데일리팜, 약사공론, 의약뉴스 등) / 해외(FiercePharma, BioPharma Dive 등) 13개+ 소스에서 RSS·크롤링 기반 자동 수집 |
|  **AI 뉴스 분석** | Google Gemini 기반 원료의약품(API) 산업 관점의 비즈니스 임팩트 자동 분석 |
|  **인텔리전스 요약** | 일일 브리핑 및 산업 인텔리전스 자동 생성 |
|  **의약품 검색** | 약물 정보 검색 및 제조사 정보 조회 |
|  **규제 동향** | FDA 승인, MFDS(식약처) 고시, 임상시험 IND 승인, 리콜 정보 통합 |
|  **NCE 특허 만료** | 신규화합물(NCE) 특허 만료 일정 추적 및 알림 |
|  **바이오 빅딜** | 글로벌 바이오텍 라이선스 딜·M&A 정보 모니터링 |
|  **스크랩 & 메모** | 기사 북마크, 메모 작성, 폴더 관리 |
|  **키워드 알림** | 사용자 관심 키워드 등록 및 매칭 뉴스 하이라이트 |
|  **다국어 번역** | 해외 뉴스 한국어 자동 번역 |

---

## 🏗️ 시스템 아키텍처

```mermaid
graph TB
    subgraph CLIENT[" Client · Browser"]
        direction LR
        React[" React 18 + Router"]
        UI[" shadcn/ui + Radix"]
        Chart[" Recharts"]
        Query[" TanStack Query"]
    end

    subgraph SUPABASE[" Supabase Backend"]
        direction TB

        subgraph EDGE[" Edge Functions · Deno"]
            direction LR

            subgraph CRAWL[" Crawlers"]
                C1["crawl-news"]
                C2["crawl-deals"]
                C3["crawl-ibric"]
                C4["crawl-cnn"]
                C5["crawl-mfds"]
                C6["crawl-regulatory"]
                C7["crawl-clinical"]
                C8["crawl-reports"]
            end

            subgraph AI[" AI Engine"]
                A1["analyze-news"]
                A2["generate-intelligence"]
                A3["generate-daily-brief"]
                A4["translate-news"]
                A5["enrich-nce-patents"]
            end

            subgraph SEARCH[" Search · Lookup"]
                S1["search-drug-info"]
                S2["search-manufacturers"]
                S3["search-external"]
                S4["pharma-chat"]
            end
        end

        CRON["Cron Scheduler · pg_cron"]

        subgraph DB[" PostgreSQL"]
            direction LR
            T1["news_articles"]
            T2["regulatory_notices"]
            T3["biotech_deals"]
            T4["nce_patent_expiry"]
            T5["bookmarks"]
            T6["intelligence_summaries"]
        end

        AUTH[" Auth"]
        REALTIME[" Realtime"]
    end

    subgraph EXTERNAL[" External Sources"]
        direction LR
        RSS[" RSS Feeds\nFiercePharma\nBioPharma Dive\nPharmaTimes"]
        GEMINI[" Google Gemini\n뉴스 분석 · 번역\n인텔리전스 생성"]
        GOV[" 공공 API\nFDA · MFDS\n임상시험 DB"]
    end

    CLIENT -- "HTTPS" --> SUPABASE
    CRON --> EDGE
    CRAWL --> DB
    AI --> DB
    SEARCH --> DB
    RSS --> CRAWL
    GOV --> CRAWL
    GEMINI --> AI

    style CLIENT fill:#1a1a2e,stroke:#16213e,color:#e0e0e0
    style SUPABASE fill:#0d1117,stroke:#3FCF8E,color:#e0e0e0
    style EDGE fill:#161b22,stroke:#58a6ff,color:#e0e0e0
    style CRAWL fill:#1c2333,stroke:#f0883e,color:#e0e0e0
    style AI fill:#1c2333,stroke:#a371f7,color:#e0e0e0
    style SEARCH fill:#1c2333,stroke:#58a6ff,color:#e0e0e0
    style DB fill:#1c2333,stroke:#3FCF8E,color:#e0e0e0
    style EXTERNAL fill:#1a1a2e,stroke:#8b949e,color:#e0e0e0
```

---

## 📡 데이터 파이프라인

```mermaid
flowchart LR
    subgraph SRC[" 외부 소스"]
        RSS[" RSS Feeds"]
        HTML[" HTML 크롤링"]
        SUB["Substack"]
        FDA[" FDA · MFDS"]
    end

    subgraph PROC[" 수집 · 처리"]
        CN["crawl-news\n· Cron: 매일 ·"]
        AN["analyze-news\n· Gemini API ·"]
        GI["generate-intelligence"]
        CR["crawl-regulatory"]
        TN["translate-news"]
    end

    subgraph STORE[" 저장"]
        NA[("news_articles")]
        AI_R[("AI 분석 결과")]
        IS[("intelligence\n_summaries")]
        RN[("regulatory\n_notices")]
    end

    subgraph VIEW[" 사용자 화면"]
        NF[" 뉴스 피드\n필터 · 검색\n키워드 하이라이트"]
        BI[" 비즈니스\n임팩트 분석"]
        DS[" 일일\n인텔리전스 요약"]
        RD[" 규제 동향\n대시보드"]
    end

    RSS --> CN
    HTML --> CN
    SUB --> CN
    FDA --> CR

    CN --> NA
    NA --> AN
    AN --> AI_R
    NA --> GI
    NA --> TN
    GI --> IS
    CR --> RN

    NA --> NF
    AI_R --> BI
    IS --> DS
    RN --> RD

    style SRC fill:#1a1a2e,stroke:#f0883e,color:#e0e0e0
    style PROC fill:#1a1a2e,stroke:#a371f7,color:#e0e0e0
    style STORE fill:#1a1a2e,stroke:#3FCF8E,color:#e0e0e0
    style VIEW fill:#1a1a2e,stroke:#58a6ff,color:#e0e0e0
```

---

## 🛠 기술 스택

### Frontend

| 기술 | 용도 |
|:---|:---|
| **React 18** | UI 렌더링 (SPA) |
| **TypeScript 5.8** | 타입 안전성 |
| **Vite 5** | 빌드 도구 & 개발 서버 |
| **TailwindCSS 3** | 유틸리티 기반 스타일링 |
| **shadcn/ui + Radix** | 접근성 준수 UI 컴포넌트 |
| **TanStack Query** | 서버 상태 관리 & 캐싱 |
| **React Router 6** | 클라이언트 라우팅 |
| **Recharts** | 데이터 시각화 차트 |
| **React Markdown** | 마크다운 렌더링 |

### Backend

| 기술 | 용도 |
|:---|:---|
| **Supabase** | BaaS (DB + Auth + Edge Functions + Realtime) |
| **PostgreSQL** | 관계형 데이터베이스 |
| **Deno (Edge Functions)** | 서버리스 함수 (크롤링, AI 분석, 검색) |
| **Google Gemini API** | 뉴스 분석 및 인텔리전스 생성 |
| **pg_cron** | 데이터 수집 자동 스케줄링 |

---

## 시작하기

### 사전 요구사항

- **Node.js** >= 18 (또는 **Bun** 런타임)
- **npm** 또는 **bun**
- Supabase 프로젝트 (환경 변수 필요)

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/your-username/acebionews.git
cd acebionews

# 2. 의존성 설치
npm install
# 또는
bun install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일에 Supabase 정보 입력
```

### 환경 변수

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### 개발 서버 실행

```bash
npm run dev     # http://localhost:5173
```

### 빌드

```bash
npm run build        # 프로덕션 빌드
npm run build:dev    # 개발 모드 빌드
npm run preview      # 빌드 결과 미리보기
```

### 테스트

```bash
npm run test         # 테스트 실행
npm run test:watch   # 워치 모드
```

---

## 📁 프로젝트 구조

```
acebionews/
├── public/                          # 정적 파일
├── src/
│   ├── components/                  # UI 컴포넌트
│   │   ├── ui/                      #   shadcn/ui 기본 컴포넌트
│   │   ├── AppHeader.tsx            #   상단 헤더 (로그인, 필터)
│   │   ├── NewsList.tsx             #   뉴스 목록 메인 뷰
│   │   ├── Sidebar.tsx              #   사이드바 (인텔리전스, 약물검색, 빅딜)
│   │   ├── FdaSection.tsx           #   FDA 규제 정보
│   │   ├── MfdsSection.tsx          #   식약처(MFDS) 정보
│   │   ├── NcePatentSection.tsx     #   NCE 특허 만료
│   │   ├── BigDealsSection.tsx      #   바이오 빅딜
│   │   ├── DrugSearchSection.tsx    #   의약품 검색
│   │   ├── KeywordAlertSection.tsx  #   키워드 알림
│   │   └── ...
│   ├── hooks/                       # 커스텀 React Hooks
│   │   ├── useNewsData.ts           #   뉴스 데이터 페칭
│   │   ├── useNewsFilters.ts        #   필터링 로직
│   │   ├── useAuth.ts               #   인증 상태 관리
│   │   ├── useBookmarks.ts          #   북마크 관리
│   │   └── useUserKeywords.ts       #   키워드 관리
│   ├── integrations/
│   │   └── supabase/                # Supabase 클라이언트 & 타입
│   ├── data/                        # Mock 데이터
│   ├── pages/                       # 페이지 컴포넌트
│   └── utils/                       # 유틸리티 함수
│
├── supabase/
│   ├── functions/                   # Edge Functions (22개)
│   │   ├── crawl-news/              #   뉴스 크롤링 (RSS + HTML)
│   │   ├── crawl-deals/             #   바이오 딜 정보 수집
│   │   ├── crawl-clinical-trials/   #   임상시험 데이터
│   │   ├── crawl-regulatory/        #   규제 공시 수집
│   │   ├── crawl-mfds-recalls/      #   식약처 리콜 정보
│   │   ├── analyze-news/            #   AI 뉴스 분석 (Gemini)
│   │   ├── generate-intelligence/   #   인텔리전스 리포트
│   │   ├── generate-daily-briefing/ #   일일 브리핑
│   │   ├── translate-news/          #   뉴스 번역
│   │   ├── search-drug-info/        #   약물 정보 검색
│   │   ├── pharma-chat/             #   AI 챗봇
│   │   └── ...
│   └── migrations/                  # DB 마이그레이션 파일
│
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 데이터베이스 스키마

```mermaid
erDiagram
    news_articles {
        uuid id PK
        text title
        text summary
        text source
        text region
        text country
        text[] api_keywords
        date date
        text url
    }

    bookmarks {
        uuid id PK
        uuid user_id FK
        uuid article_id FK
        text memo
        uuid folder_id FK
    }

    user_keywords {
        uuid id PK
        uuid user_id
        text keyword
    }

    regulatory_notices {
        uuid id PK
        text title
        date date
        text type
        text source
        text[] related_apis
    }

    biotech_deals {
        uuid id PK
        text payer
        text payee
        numeric total_m
        text indication
        text technology
        text deal_type
        date date
    }

    nce_patent_expiry {
        uuid id PK
        text drug_name
        date patent_expiry_date
        text company
        text indication
    }

    clinical_trial_approvals {
        uuid id PK
        text phase
        date approval_date
        text dev_region
    }

    intelligence_summaries {
        uuid id PK
        date summary_date
        text content
        int source_count
    }

    mfds_recalls {
        uuid id PK
        text product_name
        date recall_date
        text reason
        text company
    }

    memo_folders {
        uuid id PK
        uuid user_id
        text name
    }

    news_articles ||--o{ bookmarks : "스크랩"
    memo_folders ||--o{ bookmarks : "폴더 분류"
```

---

## 뉴스 소스

### <img src="https://flagcdn.com/w20/kr.png" width="16" height="12" alt="KR" /> 국내

| 소스 | 수집 방식 |
|:---|:---|
| 데일리팜 | HTML 크롤링 |
| 의약뉴스 | HTML 크롤링 |
| 약사공론 | HTML 크롤링 |
| 팜뉴스 | HTML 크롤링 |
| 더바이오 | HTML 크롤링 |

### 해외

| 소스 | 수집 방식 | 국가 |
|:---|:---|:---|
| FiercePharma | RSS | <img src="https://flagcdn.com/w20/us.png" width="16" height="12" alt="US" /> US |
| BioPharma Dive | RSS | <img src="https://flagcdn.com/w20/us.png" width="16" height="12" alt="US" /> US |
| PharmaTimes | RSS | <img src="https://flagcdn.com/w20/us.png" width="16" height="12" alt="US" /> US |
| Pharma Technology | RSS | <img src="https://flagcdn.com/w20/eu.png" width="16" height="12" alt="EU" /> EU |
| Express Pharma | RSS | <img src="https://flagcdn.com/w20/in.png" width="16" height="12" alt="IN" /> IN |
| ET Pharma India | HTML | <img src="https://flagcdn.com/w20/in.png" width="16" height="12" alt="IN" /> IN |
| 薬事日報 | HTML | <img src="https://flagcdn.com/w20/jp.png" width="16" height="12" alt="JP" /> JP |

---

## 라이선스

이 프로젝트는 내부 사용 목적으로 제작되었습니다.

---
