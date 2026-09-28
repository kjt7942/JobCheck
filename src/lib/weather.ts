/**
 * 기상청 위경도 -> 격자(nx, ny) 변환 및 날씨 정보 조회 서비스
 */

// 꿀송이농장 위치 (경북 문경시 산양면 금천로 142-14) — 설정/환경변수가 없을 때의 기본 좌표
export const FARM_LAT = 36.6223;
export const FARM_LNG = 128.2509;

const RE = 6371.00877; // 지구 반경(km)
const GRID = 5.0; // 격자 간격(km)
const SLAT1 = 30.0; // 투영 위도1(degree)
const SLAT2 = 60.0; // 투영 위도2(degree)
const OLON = 126.0; // 기준점 경도(degree)
const OLAT = 38.0; // 기준점 위도(degree)
const XO = 43; // 기준점 X좌표(GRID)
const YO = 136; // 기준점 Y좌표(GRID)

/**
 * 서버(UTC) 환경에서도 한국 표준시(KST) 기준 날짜 문자열(YYYY-MM-DD)을 반환합니다.
 * new Date().toISOString()은 UTC 기준이라 KST 00~09시(=UTC 15~24시)엔 하루 밀린 날짜가 나옴.
 */
export function getKstDateString(d: Date = new Date()): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export interface WeatherInfo {
  sky: string;    // 하늘상태
  pty: string;    // 강수형태
  tmx: string;    // 최고기온
  tmn: string;    // 최저기온
  tmp: string;    // 현재/기준 기온
  icon: string;   // 날씨 아이콘 키워드
}

/**
 * 위경도 좌표를 기상청 격자 좌표로 변환
 */
export function convertToGrid(lat: number, lng: number) {
  const DEGRAD = Math.PI / 180.0;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const x = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const y = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);

  return { nx: x, ny: y };
}

/**
 * 기상청 단기예보(VilageFcst) API 호출
 */
export async function getKmaWeather(lat: number, lng: number, date: string, targetDate: string = date): Promise<WeatherInfo | null> {
  const authKey = process.env.KMA_AUTH_KEY;
  if (!authKey) {
    console.error("KMA_AUTH_KEY 환경변수가 설정되지 않았습니다.");
    return null;
  }
  const { nx, ny } = convertToGrid(lat, lng);

  // base_date: YYYYMMDD (발표 기준일 = 예보를 조회할 때 사용하는 발표 시각의 날짜)
  // target: 실제로 알고 싶은 날짜 (오늘 or 최대 2~3일 뒤 미래 날짜)
  // 기상청 단기예보는 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300에 발표
  let baseDate = date.replace(/-/g, '').slice(0, 8);
  const targetFcstDate = targetDate.replace(/-/g, '').slice(0, 8);
  let baseTime = "0200"; // 고정 발표 시각 (최저/최고 기온 포함용)

  // 02시 발표분은 02:10 이후에야 조회 가능 → 오늘 00:00~02:14(KST)에는 전날 23시 발표분 사용
  // (전날 23시 발표에도 다음날 최저/최고 기온(TMN/TMX)이 포함됨)
  const now = new Date();
  const kstMinutes = ((now.getUTCHours() + 9) % 24) * 60 + now.getUTCMinutes();
  if (date === getKstDateString(now) && kstMinutes < 2 * 60 + 15) {
    baseDate = getKstDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000)).replace(/-/g, '');
    baseTime = "2300";
  }

  const url = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst?authKey=${authKey}&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}&dataType=JSON&numOfRows=1000`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      console.error("KMA API HTTP Error:", response.status);
      return null;
    }
    const data = await response.json();

    if (!data.response || !data.response.body || !data.response.body.items) {
      console.error("KMA API Error:", data.response?.header?.resultMsg || "Unknown Error");
      return null;
    }

    // 응답에는 발표일 이후 며칠치 예보가 함께 내려오므로, 실제 알고 싶은 날짜(targetFcstDate)의 항목만 사용
    const items = (data.response.body.items.item as { category: string; fcstDate: string; fcstTime: string; fcstValue: string }[]).filter(item => item.fcstDate === targetFcstDate);

    let tmn: string | undefined;
    let tmx: string | undefined;

    // 시간대별로 묶어서, 정오(12시)에 가장 가까운 시간대를 그날의 대표 하늘상태/강수형태/기온으로 사용
    const byTime = new Map<string, Record<string, string>>();
    items.forEach((item) => {
      if (item.category === "TMN") tmn = item.fcstValue;
      if (item.category === "TMX") tmx = item.fcstValue;
      if (!byTime.has(item.fcstTime)) byTime.set(item.fcstTime, {});
      byTime.get(item.fcstTime)![item.category] = item.fcstValue;
    });

    let representative: Record<string, string> | undefined;
    let bestDiff = Infinity;
    for (const [fcstTime, slot] of byTime) {
      const hour = parseInt(fcstTime.slice(0, 2), 10);
      const diff = Math.abs(hour - 12);
      if (diff < bestDiff) {
        bestDiff = diff;
        representative = slot;
      }
    }

    const sky = representative?.SKY || "1";
    const pty = representative?.PTY || "0";
    const tmp = representative?.TMP || "-";

    // 날씨 아이콘 결정 (기상청 SKY: 1 맑음, 3 구름많음, 4 흐림 / PTY: 1 비, 2 비/눈, 3 눈, 4 소나기)
    let icon = "sun";
    if (pty !== "0") {
      icon = pty === "1" || pty === "4" ? "cloud-rain" : "cloud-snow";
    } else {
      if (sky === "3") icon = "cloud-sun";
      else if (sky === "4") icon = "cloud";
    }

    return {
      sky,
      pty,
      tmx: tmx || "-",
      tmn: tmn || "-",
      tmp,
      icon
    };
  } catch (error) {
    console.error("Weather Fetch Fail:", error);
    return null;
  }
}

/**
 * 기상청 SKY/PTY 코드를 앱에서 쓰는 5가지 날씨 라벨로 변환 ("맑음","흐림","비","바람","눈")
 */
export function toWeatherLabel(sky: string, pty: string, wsd?: string): string {
  if (pty === "1" || pty === "4" || pty === "5") return "비"; // 비, 소나기, 빗방울
  if (pty === "2" || pty === "3" || pty === "6" || pty === "7") return "눈"; // 비/눈, 눈, 빗방울눈날림, 눈날림

  // 강수가 없는 경우: 강풍이면 "바람", 아니면 하늘상태로 판정
  const windSpeed = wsd ? parseFloat(wsd) : 0;
  if (windSpeed >= 8) return "바람"; // 초속 8m 이상(센바람)이면 바람으로 표시

  if (sky === "3" || sky === "4") return "흐림"; // 구름많음, 흐림
  return "맑음";
}

// 문경 종관기상관측소(ASOS) 지점번호 — 농장(산양면)에서 가장 가까운 기상청 관측소
export const FARM_ASOS_STN = 273;

export interface AsosDaily {
  date: string;         // YYYY-MM-DD
  weather: string;      // 맑음/흐림/비/눈
  temp_max: number;
  temp_min: number;
  raw_sky: string;      // 운량으로 환산한 SKY 코드 (1 맑음, 3 구름많음, 4 흐림)
  raw_pty: string;      // 0 없음, 1 비, 3 눈
  rain_mm: number;      // 일강수량 (mm)
}

/**
 * 기상청 ASOS 일자료(kma_sfcdd3) 한 줄을 앱 날씨로 변환 (실측값이 없으면 null)
 * 판정: 신적설>0 또는 영하에 1mm 이상 강수 → 눈 / 일강수량 1mm 이상 → 비 / 평균운량 6할 이상 → 흐림 / 그 외 맑음
 * ponytail: 1mm 미만 약한 비는 "비"로 치지 않음 — 기준을 바꾸려면 RAIN_MM만 조정
 */
export function parseAsosDailyLine(line: string): AsosDaily | null {
  const RAIN_MM = 1.0;
  const c = line.trim().split(/\s+/);
  if (c.length < 48 || !/^\d{8}$/.test(c[0])) return null;
  // 결측: 강수/운량/적설 같은 0 이상 값은 음수(-9), 기온은 -99 (영하 9도 이하 실제 기온과 구분)
  const amount = (i: number) => { const v = parseFloat(c[i]); return isNaN(v) || v < 0 ? null : v; };
  const temp = (i: number) => { const v = parseFloat(c[i]); return isNaN(v) || v <= -50 ? null : v; };
  const taAvg = temp(10), taMax = temp(11), taMin = temp(13), ca = amount(31), rn = amount(38), sdNew = amount(47);
  if (taMax === null || taMin === null) return null;

  const rain = rn ?? 0;
  const snow = (sdNew ?? 0) > 0 || (rain >= RAIN_MM && taAvg !== null && taAvg <= 0);
  const sky = ca === null ? "1" : ca >= 9 ? "4" : ca >= 6 ? "3" : "1";
  const pty = snow ? "3" : rain >= RAIN_MM ? "1" : "0";
  return {
    date: `${c[0].slice(0, 4)}-${c[0].slice(4, 6)}-${c[0].slice(6, 8)}`,
    weather: toWeatherLabel(sky, pty),
    temp_max: taMax,
    temp_min: taMin,
    raw_sky: sky,
    raw_pty: pty,
    rain_mm: rain,
  };
}

/**
 * 기상청 ASOS 일자료 조회 (from~to, YYYY-MM-DD). 관측 완료된 과거 날짜만 제공됨.
 */
export async function getAsosDaily(from: string, to: string, stn: number = FARM_ASOS_STN): Promise<AsosDaily[]> {
  const authKey = process.env.KMA_AUTH_KEY;
  if (!authKey) throw new Error("KMA_AUTH_KEY 환경변수가 설정되지 않았습니다.");
  const url = `https://apihub.kma.go.kr/api/typ01/url/kma_sfcdd3.php?tm1=${from.replace(/-/g, "")}&tm2=${to.replace(/-/g, "")}&stn=${stn}&help=0&authKey=${authKey}`;
  // API허브가 간헐적으로 응답을 멈추는 경우가 있어 짧은 타임아웃으로 최대 3회 시도
  let text = "";
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`ASOS 일자료 HTTP ${res.status}`);
      text = await res.text();
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
    }
  }
  if (text.includes('"status"')) throw new Error(`ASOS 일자료 오류: ${text.slice(0, 200)}`);
  return text.split("\n").map(parseAsosDailyLine).filter((d): d is AsosDaily => d !== null);
}

// 간단 자체검증: node --experimental-strip-types src/lib/weather.ts
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("weather.ts")) {
  const row = (ta: string, max: string, min: string, ca: string, rn: string, sd: string) => {
    const c = Array(56).fill("-9.0");
    c[0] = "20260101"; c[1] = "273"; c[10] = ta; c[11] = max; c[13] = min; c[31] = ca; c[38] = rn; c[47] = sd;
    return c.join(" ");
  };
  console.assert(parseAsosDailyLine(row("-7.1", "-2.8", "-11.0", "2.0", "-9.0", "-9.0"))?.temp_min === -11, "영하 11도는 실제값");
  console.assert(parseAsosDailyLine(row("-7.1", "-99.0", "-11.0", "2.0", "-9.0", "-9.0")) === null, "-99 기온은 결측");
  console.assert(parseAsosDailyLine(row("20", "25", "15", "8.1", "3.1", "-9.0"))?.weather === "비", "3.1mm → 비");
  console.assert(parseAsosDailyLine(row("20", "25", "15", "8.1", "0.5", "-9.0"))?.weather === "흐림", "0.5mm + 운량 8 → 흐림");
  console.assert(parseAsosDailyLine(row("-2", "1", "-5", "9.5", "2.0", "1.2"))?.weather === "눈", "신적설 → 눈");
  console.assert(parseAsosDailyLine(row("15", "20", "10", "3.0", "-9.0", "-9.0"))?.weather === "맑음", "맑음");
  console.log("weather self-check done");
}
