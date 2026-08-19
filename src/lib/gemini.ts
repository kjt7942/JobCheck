/**
 * Google AI Studio (Gemini) 영수증 이미지 OCR 서비스
 */

export interface ReceiptExtract {
  date: string | null;     // YYYY-MM-DD
  category: string | null;
  amount: number | null;
  memo: string | null;
}

// 우선순위: 1순위 실패(과부하/오류) 시 다음 모델로 자동 폴백
const MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.1-flash-lite"];

/**
 * 영수증/명세서 이미지(base64)에서 날짜/분류/금액/메모를 추출합니다.
 * @param categories 분류 후보 목록 (가장 가까운 값으로 매핑하도록 유도)
 */
export async function extractReceiptInfo(
  base64Data: string,
  mimeType: string,
  categories: string[]
): Promise<ReceiptExtract | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
    return null;
  }

  const prompt =
    `이 영수증/명세서 이미지에서 정보를 추출해서 JSON으로만 답해줘.\n` +
    `- date: 결제/발행 날짜 (YYYY-MM-DD). 못 찾으면 null.\n` +
    `- category: 다음 목록 중 가장 가까운 하나 [${categories.join(", ")}]. 애매하면 "기타".\n` +
    `- amount: 총 결제 금액(숫자만, 원 단위 정수). 못 찾으면 null.\n` +
    `- memo: 상호명이나 품목을 20자 이내로 요약. 못 찾으면 null.\n` +
    `형식: {"date":"YYYY-MM-DD","category":"...","amount":12345,"memo":"..."}`;

  const body = JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64Data } },
      ],
    }],
    generationConfig: { responseMimeType: "application/json" },
  });

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      let response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });

      // ponytail: 무료 티어는 503(과부하)이 흔함, 짧게 대기 후 같은 모델로 1회만 재시도
      if (response.status === 503) {
        await new Promise(r => setTimeout(r, 1500));
        response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      }

      if (!response.ok) {
        console.error(`Gemini API Error (${model}):`, response.status, await response.text());
        continue; // 다음 우선순위 모델로 폴백
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.error(`Gemini API 응답에 결과 텍스트가 없습니다 (${model}):`, JSON.stringify(data));
        continue;
      }

      const parsed = JSON.parse(text);
      return {
        date: parsed.date || null,
        category: parsed.category || null,
        amount: typeof parsed.amount === "number" ? parsed.amount : null,
        memo: parsed.memo || null,
      };
    } catch (error) {
      console.error(`Gemini 영수증 인식 실패 (${model}):`, error);
    }
  }

  return null;
}
