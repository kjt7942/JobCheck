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
  const authKey = process.env.KMA_AUTH_KEY || "mLx6CrVUQX68egq1VEF-NA";
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

    const items = data.response.body.items.item;
    const info: Partial<WeatherInfo> = {};

    items.forEach((item: any) => {
      if (item.category === "TMN") info.tmn = item.fcstValue;
      if (item.category === "TMX") info.tmx = item.fcstValue;
      if (item.category === "SKY") info.sky = item.fcstValue;
      if (item.category === "PTY") info.pty = item.fcstValue;
      if (item.category === "TMP") info.tmp = item.fcstValue;
    });

    // 날씨 아이콘 결정 (기상청 SKY: 1 맑음, 3 구름많음, 4 흐림 / PTY: 1 비, 2 비/눈, 3 눈, 4 소나기)
    let icon = "sun";
    if (info.pty !== "0") {
      icon = info.pty === "1" || info.pty === "4" ? "cloud-rain" : "cloud-snow";
    } else {
      if (info.sky === "3") icon = "cloud-sun";
      else if (info.sky === "4") icon = "cloud";
    }

    return {
      sky: info.sky || "1",
      pty: info.pty || "0",
      tmx: info.tmx || "-",
      tmn: info.tmn || "-",
      tmp: info.tmp || "-",
      icon: icon
    };
  } catch (error) {
    console.error("Weather Fetch Fail:", error);
    return null;
  }
}
