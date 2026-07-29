/**
 * 기상청 위경도 -> 격자(nx, ny) 변환 및 날씨 정보 조회 서비스
 */

const RE = 6371.00877; // 지구 반경(km)
const GRID = 5.0; // 격자 간격(km)
const SLAT1 = 30.0; // 투영 위도1(degree)
const SLAT2 = 60.0; // 투영 위도2(degree)
const OLON = 126.0; // 기준점 경도(degree)
const OLAT = 38.0; // 기준점 위도(degree)
const XO = 43; // 기준점 X좌표(GRID)
const YO = 136; // 기준점 Y좌표(GRID)

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
export async function getKmaWeather(lat: number, lng: number, date: string): Promise<WeatherInfo | null> {
  const authKey = process.env.KMA_AUTH_KEY;
  if (!authKey) {
    console.error("KMA_AUTH_KEY 환경변수가 설정되지 않았습니다.");
    return null;
  }
  const { nx, ny } = convertToGrid(lat, lng);

  // base_date: YYYYMMDD
  // 기상청 단기예보는 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300에 발표
  // 가장 최근 발표 시각을 계산
  const now = new Date();
  const baseDate = date.replace(/-/g, '').slice(0, 8);
  const baseTime = "0200"; // 고정 발표 시각 (최저/최고 기온 포함용)

  const url = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst?authKey=${authKey}&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}&dataType=JSON&numOfRows=1000`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.response || !data.response.body || !data.response.body.items) {
      console.error("KMA API Error:", data.response?.header?.resultMsg || "Unknown Error");
      return null;
    }

    // 응답에는 요청일 이후 며칠치 예보가 함께 내려오므로, 요청한 날짜(baseDate)의 항목만 사용
    const items = (data.response.body.items.item as any[]).filter(item => item.fcstDate === baseDate);

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
