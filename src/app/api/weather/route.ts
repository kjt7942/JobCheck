import { NextResponse } from "next/server";
import { getKmaWeather, toWeatherLabel, getKstDateString } from "@/lib/weather";

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

  const today = getKstDateString();
  // date 파라미터가 있으면 해당 날짜(최대 2~3일 뒤 미래) 예보를 조회, 없으면 오늘
  const hasExplicitDate = searchParams.has("date");
  const targetDate = searchParams.get("date") || today;

  try {
    const info = await getKmaWeather(lat, lng, today, targetDate);

    // 오늘 날씨 자동입력(date 파라미터 없음)은 기온까지 확실해야 의미 있으므로 기존처럼 엄격하게 체크.
    // 미래 날짜 예보 조회(방제-강우 경고 등)는 기온(TMN/TMX)이 그 시간대에 없어도 하늘상태/강수형태(비 여부)는
    // 유효할 수 있으므로, info 자체가 없을 때만 실패로 처리.
    const isFailure = !info || (!hasExplicitDate && (info.tmx === "-" || info.tmn === "-"));
    if (isFailure) {
      console.warn(`[기상청 날씨 조회 실패] lat=${lat}, lng=${lng}, date=${targetDate}`);
      return NextResponse.json({
        success: false,
        error: "기상청 예보 데이터를 가져오지 못했습니다.",
        message: "날씨와 온도를 직접 입력해 주세요!"
      }, { status: 422 });
    }

    const weather = toWeatherLabel(info!.sky, info!.pty);

    console.log(`[기상청 날씨 조회 성공] 날씨: ${weather}, 최고: ${info!.tmx}℃, 최저: ${info!.tmn}℃ (lat=${lat}, lng=${lng}, date=${targetDate})`);

    return NextResponse.json({
      success: true,
      weather,
      temp_max: info!.tmx !== "-" ? parseFloat(info!.tmx) : undefined,
      temp_min: info!.tmn !== "-" ? parseFloat(info!.tmn) : undefined,
      raw_sky: info!.sky,
      raw_pty: info!.pty
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
