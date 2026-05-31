import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 🌍 네이버 실시간 날씨 검색 파싱 서버 라우트 핸들러 (CORS 완벽 회피 및 100% 실시간 동기화)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address") || "문경시 산양면";

  // 네이버 검색 날씨 쿼리 조합
  const query = encodeURIComponent(`${address} 날씨`);
  const naverUrl = `https://search.naver.com/search.naver?query=${query}`;

  try {
    console.log(`[네이버 날씨 크롤링 실행] 주소: ${address}`);

    const response = await fetch(naverUrl, {
      cache: "no-store", // 30분 캐싱을 완전히 풀고 항상 실시간 네이버 다이렉트 fetch 적용
      headers: {
        // 모바일 헤더를 적용하여 아주 콤팩트하고 파싱하기 쉬운 HTML 구조 유도
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!response.ok) {
      throw new Error(`네이버 날씨 응답 실패: ${response.status}`);
    }

    const html = await response.text();

    // 1. 최고/최저기온 파싱 (네이버 실시간 검색 날씨 카드 다단계 정밀 파싱)
    let tempMax: number | null = null;
    let tempMin: number | null = null;

    // A. 최고기온 다단계 포격 매칭
    const highestMatch = html.match(/최고기온\s*(-?\d+)°/);
    const highestMatch2 = html.match(/최고\s*기온\s*(-?\d+)°/);
    const desktopHigh = html.match(/class="[^"]*high[^"]*"[^>]*>(-?\d+)°/);
    const desktopHigh2 = html.match(/(-?\d+)°<span class="blind">최고기온<\/span>/);
    const weeklyHigh = html.match(/<span class="highest">[\s\S]*?(-?\d+)°/);
    const temperatureHigh = html.match(/temperature_text[\s\S]*?highest[\s\S]*?(-?\d+)°/);

    if (highestMatch && highestMatch[1]) {
      tempMax = parseInt(highestMatch[1], 10);
    } else if (highestMatch2 && highestMatch2[1]) {
      tempMax = parseInt(highestMatch2[1], 10);
    } else if (desktopHigh2 && desktopHigh2[1]) {
      tempMax = parseInt(desktopHigh2[1], 10);
    } else if (desktopHigh && desktopHigh[1]) {
      tempMax = parseInt(desktopHigh[1], 10);
    } else if (weeklyHigh && weeklyHigh[1]) {
      tempMax = parseInt(weeklyHigh[1], 10);
    } else if (temperatureHigh && temperatureHigh[1]) {
      tempMax = parseInt(temperatureHigh[1], 10);
    }

    // B. 최저기온 다단계 포격 매칭
    const lowestMatch = html.match(/최저기온\s*(-?\d+)°/);
    const lowestMatch2 = html.match(/최저\s*기온\s*(-?\d+)°/);
    const desktopLow = html.match(/class="[^"]*low[^"]*"[^>]*>(-?\d+)°/);
    const desktopLow2 = html.match(/(-?\d+)°<span class="blind">최저기온<\/span>/);
    const weeklyLow = html.match(/<span class="lowest">[\s\S]*?(-?\d+)°/);
    const temperatureLow = html.match(/temperature_text[\s\S]*?lowest[\s\S]*?(-?\d+)°/);

    if (lowestMatch && lowestMatch[1]) {
      tempMin = parseInt(lowestMatch[1], 10);
    } else if (lowestMatch2 && lowestMatch2[1]) {
      tempMin = parseInt(lowestMatch2[1], 10);
    } else if (desktopLow2 && desktopLow2[1]) {
      tempMin = parseInt(desktopLow2[1], 10);
    } else if (desktopLow && desktopLow[1]) {
      tempMin = parseInt(desktopLow[1], 10);
    } else if (weeklyLow && weeklyLow[1]) {
      tempMin = parseInt(weeklyLow[1], 10);
    } else if (temperatureLow && temperatureLow[1]) {
      tempMin = parseInt(temperatureLow[1], 10);
    }

    // 2. 날씨 상태 파싱
    let weatherState: string | null = null;
    
    // 모바일 네이버 기상 텍스트 매칭 (before_slash 유무에 관계없이 칼같이 수집하도록 보강)
    const weatherMatch = html.match(/<span class="weather before_slash">([^<]+)<\/span>/);
    const weatherMatch2 = html.match(/<span class="weather">([^<]+)<\/span>/);
    const weatherMatch3 = html.match(/class="weather"[^>]*>([^<]+)<\/span>/);

    if (weatherMatch && weatherMatch[1]) {
      weatherState = weatherMatch[1].trim();
    } else if (weatherMatch2 && weatherMatch2[1]) {
      weatherState = weatherMatch2[1].trim();
    } else if (weatherMatch3 && weatherMatch3[1]) {
      weatherState = weatherMatch3[1].trim();
    } else {
      // 서브 매칭: 날씨 요약 문구에서 추출
      const summaryMatch = html.match(/class="summary"[^>]*>([^<]+)<\/p>/);
      if (summaryMatch && summaryMatch[1]) {
        const summaryText = summaryMatch[1];
        if (summaryText.includes("비") || summaryText.includes("소나기")) {
          weatherState = "비";
        } else if (summaryText.includes("눈")) {
          weatherState = "눈";
        } else if (summaryText.includes("흐림")) {
          weatherState = "흐림";
        } else if (summaryText.includes("구름") || summaryText.includes("맑음")) {
          weatherState = summaryText.includes("맑음") ? "맑음" : "흐림";
        }
      }
    }

    // 🚫 기만 방지 초정밀 예외 검증 레이어 탑재
    // 데이터 파싱에 하나라도 실패했다면, 임의의 디폴트값으로 속여서 '성공' 메시지를 띄우는 행위를 원천 중단합니다.
    if (tempMax === null || tempMin === null || weatherState === null) {
      const errorMsg = `기상 정보 정밀 파싱 실패 (최고기온: ${tempMax !== null ? '성공' : '실패'}, 최저기온: ${tempMin !== null ? '성공' : '실패'}, 날씨: ${weatherState !== null ? '성공' : '실패'})`;
      console.warn(`[날씨 연동 실패 경보] ${errorMsg}`);
      return NextResponse.json({
        success: false,
        error: errorMsg,
        message: "네이버 날씨 페이지의 레이아웃 구조가 최근 변경되어 기상 정보를 읽어올 수 없습니다. 날씨와 온도를 직접 입력해 주세요!"
      }, { status: 422 }); // 데이터 파싱 불능 상태 반환
    }

    // 영농 캘린더 날씨 5대 옵션 규격화 ("맑음", "흐림", "비", "바람", "눈")
    let finalWeather = "맑음";
    if (weatherState.includes("비") || weatherState.includes("소나기") || weatherState.includes("강수")) {
      finalWeather = "비";
    } else if (weatherState.includes("눈") || weatherState.includes("진눈깨비")) {
      finalWeather = "눈";
    } else if (weatherState.includes("흐림") || weatherState.includes("구름많음") || weatherState.includes("안개")) {
      finalWeather = "흐림";
    } else if (weatherState.includes("바람") || weatherState.includes("태풍") || weatherState.includes("황사")) {
      finalWeather = "바람";
    } else {
      finalWeather = "맑음";
    }

    console.log(`[네이버 날씨 파싱 성공] 날씨: ${finalWeather} (원본: ${weatherState}), 최고: ${tempMax}℃, 최저: ${tempMin}℃`);

    return NextResponse.json({
      success: true,
      weather: finalWeather,
      temp_max: tempMax,
      temp_min: tempMin,
      raw_state: weatherState,
      response: {
        body: {
          items: {
            item: [
              { category: "TMX", fcstValue: String(tempMax) },
              { category: "TMN", fcstValue: String(tempMin) },
              { category: "PTY", fcstValue: finalWeather === "비" ? "1" : finalWeather === "눈" ? "2" : "0" },
              { category: "SKY", fcstValue: finalWeather === "맑음" ? "1" : "3" }
            ]
          }
        }
      }
    });

  } catch (error: any) {
    console.error("서버 네이버 날씨 크롤링 에러:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "네이버 날씨 정보 호출 에러",
      message: "날씨 연동 서버와의 연결에 실패했습니다. 날씨 정보를 직접 수동으로 작성해 주세요!"
    }, { status: 500 });
  }
}
