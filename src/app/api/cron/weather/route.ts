import { NextResponse } from "next/server";
import { getKmaWeather, toWeatherLabel, getKstDateString, getAsosDaily, FARM_LAT, FARM_LNG, FARM_ASOS_STN } from "@/lib/weather";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * 최근 며칠의 예보 캐시를 문경 관측소(ASOS) 실측값으로 교체합니다.
 * 예보 캐시를 그대로 복사해 둔 반복 일정 인스턴스(완료 체크본 등)도 함께 실측값으로 갱신.
 * 실패해도 오늘 예보 저장에는 영향 없음 (다음 날 크론이 다시 시도).
 */
async function correctWithObservations(today: string): Promise<number> {
  const day = (offset: number) => getKstDateString(new Date(Date.now() - offset * 24 * 60 * 60 * 1000));
  if (day(0) !== today) return 0;
  const observed = await getAsosDaily(day(3), day(1));
  const source = `asos_${FARM_ASOS_STN}`;
  for (const o of observed) {
    const ref = adminDb.collection("daily_weather").doc(o.date);
    const prev = (await ref.get()).data(); // 이미 실측이어도 다시 기록 (새벽엔 전날 통계가 늦게 확정될 수 있음)
    await ref.set({ ...o, fetched_at: Date.now(), source });
    if (!prev) continue;
    const copies = await adminDb.collection("jobs").where("instance_date", "==", o.date).get();
    await Promise.all(copies.docs
      .filter(d => { const j = d.data(); return j.weather === prev.weather && j.temp_max === prev.temp_max && j.temp_min === prev.temp_min; })
      .map(d => d.ref.update({ weather: o.weather, temp_max: o.temp_max, temp_min: o.temp_min })));
  }
  return observed.length;
}

// 🌅 Vercel Cron 전용: 매일 새벽 기상청 공식 예보를 가져와 그날의 공용 날씨로 저장 + 지난 며칠은 관측값으로 보정
export async function GET(request: Request) {
  // Vercel Cron이 보내는 요청인지 검증 (CRON_SECRET이 설정된 경우에만 강제)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const lat = parseFloat(process.env.FARM_LAT || String(FARM_LAT));
  const lng = parseFloat(process.env.FARM_LNG || String(FARM_LNG));
  const today = getKstDateString();

  let corrected = 0;
  try {
    corrected = await correctWithObservations(today);
  } catch (e) {
    console.error("[날씨 Cron] 관측값 보정 실패 (다음 실행 때 재시도):", e);
  }

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
      fetched_at: Date.now(),
      source: "forecast"
    });

    console.log(`[날씨 Cron 성공] ${today} 날씨: ${weather}, 최고: ${tempMax}℃, 최저: ${tempMin}℃`);

    return NextResponse.json({ success: true, date: today, weather, temp_max: tempMax, temp_min: tempMin, corrected_days: corrected });
  } catch (error) {
    console.error("날씨 Cron 실행 에러:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "날씨 Cron 실행 에러" }, { status: 500 });
  }
}
