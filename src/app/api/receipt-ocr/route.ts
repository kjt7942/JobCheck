import { NextResponse } from "next/server";
import { extractReceiptInfo } from "@/lib/gemini";

export const dynamic = "force-dynamic";

// 📷 영수증 이미지를 Gemini로 분석해 날짜/분류/금액/메모를 추출하는 라우트 핸들러
export async function POST(request: Request) {
  try {
    const { image, mimeType, categories } = await request.json();

    if (!image || !mimeType) {
      return NextResponse.json({ success: false, error: "이미지가 없습니다." }, { status: 400 });
    }

    const result = await extractReceiptInfo(image, mimeType, Array.isArray(categories) ? categories : []);

    if (!result) {
      return NextResponse.json({
        success: false,
        error: "영수증 인식에 실패했습니다.",
        message: "날짜/분류/금액을 직접 입력해 주세요!"
      }, { status: 422 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("영수증 OCR 에러:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "영수증 OCR 에러",
      message: "날짜/분류/금액을 직접 입력해 주세요!"
    }, { status: 500 });
  }
}
