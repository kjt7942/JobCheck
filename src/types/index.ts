export interface RecurrenceRule {
  type: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM";
  interval: number;
  end_date: string; // ISO 8601 반복 종료일
}

/**
 * 꿀송이농장 공통 작업(할일) 타입
 */
export interface Job {
  id?: string;          // Firestore 문서 ID
  task: string;         // 할일 내용
  date: string;         // 수행일 (YYYY-MM-DD)
  is_done: boolean;     // 완료 여부
  user_id: string;      // 등록한 사람의 UID (관리용)
  group_id: string;     // 반복 할일 등을 위한 그룹 ID
  temp_max?: number;    // 최고 기온
  temp_min?: number;    // 최저 기온
  weather?: string;     // 날씨 설명 (맑음, 흐림 등)
  image_urls?: string[]; // 첨부된 이미지 URL 리스트
  created_at: number;   // 생성 시간 (timestamp)
  
  // 🚀 [2단계: 마스터-인스턴스 핵심 추가 필드]
  recurrence?: RecurrenceRule; // 반복 규칙 (이 필드가 있으면 반복 마스터 일정)
  is_instance?: boolean;       // 특정 날짜에 데이터가 변경되어 생성된 인스턴스 여부
  instance_date?: string;     // 인스턴스가 적용되는 구체적 날짜 (YYYY-MM-DD)
  is_cancelled?: boolean;     // 특정 날짜의 반복 일정이 삭제되었는지 여부

  // 🆕 피드백 기능 관련 추가 필드
  feedback?: string;          // 영농 개선 사항 및 잘못된 점 기록
  feedback_tags?: string[];   // 피드백 관련 태그 리스트
}

/**
 * 사용자 세부 권한 타입
 */
export interface UserPermissions {
  canRead: boolean;    // 조회 권한
  canWrite: boolean;   // 등록/수정 권한
  canDelete: boolean;  // 삭제 권한
}

/**
 * 사용자별 개별 설정 타입
 */
export interface UserSettings {
  user_id: string;      // 사용자의 UID
  email: string;        // 사용자 이메일 (계정 ID)
  user_name: string;    // 사용자 이름 (대장님, 아내분 등)
  farm_name: string;    // 농장 이름 (기본값: 꿀송이농장)
  latitude: number;     // 위도
  longitude: number;    // 경도
  location: string;     // 지역 이름
  start_day: number;    // 시작 요일 (0: 일요일, 1: 월요일)
  theme: 'light' | 'dark' | 'farm'; // 앱 테마
  role: 'admin' | 'user'; // 사용자 역할 (관리자/일반사용자)
  permissions: UserPermissions; // 세부 권한
  updated_at: number;   // 마지막 수정 시간
}

/**
 * 살포(방제) 이력 및 PHI(수확전 안전사용기준일) 계산 기록
 */
export interface SprayRecord {
  id?: string;
  chemical_name: string; // 약제명
  spray_date: string;    // 살포일 (YYYY-MM-DD)
  phi_days: number;      // 안전사용기준일수 (수확 며칠 전까지 살포 금지인지)
  memo?: string;
  user_id: string;
  created_at: number;
}

/**
 * 농장 기록부 (투입 비용 / 수확·매출 기록)
 */
export interface FarmRecord {
  id?: string;
  type: 'cost' | 'harvest';
  date: string;         // YYYY-MM-DD
  category?: string;    // cost: 농약/비료/인건비/유류/기타 등, harvest: 품종/구역 등 (자유 입력)
  amount: number;       // cost: 지출 금액(원), harvest: 수확량(kg)
  unit_price?: number;  // harvest 전용: 판매 단가(원/kg). 있으면 매출 = amount * unit_price
  memo?: string;
  image_urls?: string[]; // 영수증/거래명세서 등 첨부 이미지 URL 리스트
  user_id: string;
  created_at: number;
}

/**
 * 날짜별 공용 날씨 캐시 타입 (매일 새벽 Cron이 기상청 API로 채워넣음)
 */
export interface DailyWeather {
  date: string;         // YYYY-MM-DD
  weather: string;      // 맑음/흐림/비/바람/눈
  temp_max: number;     // 최고 기온
  temp_min: number;     // 최저 기온
  raw_sky: string;      // 기상청 SKY 코드 (원본)
  raw_pty: string;      // 기상청 PTY 코드 (원본)
  fetched_at: number;   // 조회 시각 (timestamp)
}
