import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getKstDateString } from "@/lib/weather";

export const dynamic = "force-dynamic";

// 🩺 공개 상태 확인용 라우트: 오늘의 날씨 Cron이 정상적으로 기록됐는지 인증 없이 조회
// (민감정보 없이 오늘 날씨 요약 + 수집 시각만 반환하므로 별도 인증을 요구하지 않음)
export async function GET() {
  const today = getKstDateString();

  try {
    const doc = await adminDb.collection("daily_weather").doc(today).get();

    if (!doc.exists) {
      return NextResponse.json({ exists: false, date: today });
    }

    const data = doc.data()!;
    const minutesSinceFetch = Math.round((Date.now() - data.fetched_at) / 60000);

    return NextResponse.json({
      exists: true,
      date: data.date,
      weather: data.weather,
      temp_max: data.temp_max,
      temp_min: data.temp_min,
      fetched_at: data.fetched_at,
      fetched_at_iso: new Date(data.fetched_at).toISOString(),
      minutes_since_fetch: minutesSinceFetch
    });
  } catch (error: any) {
    return NextResponse.json({ exists: false, date: today, error: error.message || String(error) }, { status: 500 });
  }
}
