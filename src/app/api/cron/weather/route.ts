import { NextResponse } from "next/server";
import { getKmaWeather, toWeatherLabel, getKstDateString } from "@/lib/weather";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// 🌅 Vercel Cron 전용: 매일 새벽 기상청 공식 예보를 가져와 그날의 공용 날씨로 저장
export async function GET(request: Request) {
  // Vercel Cron이 보내는 요청인지 검증 (CRON_SECRET이 설정된 경우에만 강제)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const lat = parseFloat(process.env.FARM_LAT || "36.3504");
  const lng = parseFloat(process.env.FARM_LNG || "127.3845");
  const today = getKstDateString();

  try {
    const info = await getKmaWeather(lat, lng, today);

    if (!info || info.tmx === "-" || info.tmn === "-") {
      console.error(`[날씨 Cron 실패] 기상청 데이터를 가져오지 못했습니다. lat=${lat}, lng=${lng}`);
      return NextResponse.json({
        success: false,
        error: "기상청 예보 데이터를 가져오지 못했습니다."
      }, { status: 422 });
    }

    const weather = toWeatherLabel(info.sky, info.pty);
    const tempMax = parseFloat(info.tmx);
    const tempMin = parseFloat(info.tmn);

    await adminDb.collection("daily_weather").doc(today).set({
      date: today,
      weather,
      temp_max: tempMax,
      temp_min: tempMin,
      raw_sky: info.sky,
      raw_pty: info.pty,
      fetched_at: Date.now()
    });

    console.log(`[날씨 Cron 성공] ${today} 날씨: ${weather}, 최고: ${tempMax}℃, 최저: ${tempMin}℃`);

    return NextResponse.json({ success: true, date: today, weather, temp_max: tempMax, temp_min: tempMin });
  } catch (error: any) {
    console.error("날씨 Cron 실행 에러:", error);
    return NextResponse.json({ success: false, error: error.message || "날씨 Cron 실행 에러" }, { status: 500 });
  }
}
