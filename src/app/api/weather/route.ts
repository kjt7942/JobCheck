import { NextResponse } from "next/server";
import { getKmaWeather, toWeatherLabel } from "@/lib/weather";

export const dynamic = "force-dynamic";

// 🌍 기상청 공식 단기예보(VilageFcst) API를 이용한 날씨 조회 라우트 핸들러
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");

  // 기본값: 문경시 산양면
  const lat = latParam ? parseFloat(latParam) : 36.3504;
  const lng = lngParam ? parseFloat(lngParam) : 127.3845;

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({
      success: false,
      error: "잘못된 위경도 값입니다.",
      message: "날씨와 온도를 직접 입력해 주세요!"
    }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const info = await getKmaWeather(lat, lng, today);

    if (!info || info.tmx === "-" || info.tmn === "-") {
      console.warn(`[기상청 날씨 조회 실패] lat=${lat}, lng=${lng}`);
      return NextResponse.json({
        success: false,
        error: "기상청 예보 데이터를 가져오지 못했습니다.",
        message: "날씨와 온도를 직접 입력해 주세요!"
      }, { status: 422 });
    }

    const weather = toWeatherLabel(info.sky, info.pty);

    console.log(`[기상청 날씨 조회 성공] 날씨: ${weather}, 최고: ${info.tmx}℃, 최저: ${info.tmn}℃ (lat=${lat}, lng=${lng})`);

    return NextResponse.json({
      success: true,
      weather,
      temp_max: parseFloat(info.tmx),
      temp_min: parseFloat(info.tmn),
      raw_sky: info.sky,
      raw_pty: info.pty
    });
  } catch (error: any) {
    console.error("기상청 날씨 조회 에러:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "기상청 날씨 조회 에러",
      message: "날씨 연동 서버와의 연결에 실패했습니다. 날씨 정보를 직접 수동으로 작성해 주세요!"
    }, { status: 500 });
  }
}
