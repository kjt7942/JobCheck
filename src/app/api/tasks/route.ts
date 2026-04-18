import { Client } from "@notionhq/client";
import { NextResponse } from "next/server";
import { getKmaWeather } from "@/lib/weather";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID!;

export async function GET() {
  try {
    const response = await (notion as any).databases.query({
      database_id: databaseId,
      sorts: [{ property: "일자", direction: "descending" }],
    });

    const tasks = response.results.map((page: any) => {
      const props = page.properties;
      
      const title = props["Name"]?.title?.[0]?.plain_text || "이름 없는 작업";
      const date = props["일자"]?.date?.start || page.created_time;
      const completed = props["완료여부"]?.checkbox || false;

      let weather = props["날씨"]?.rich_text?.[0]?.plain_text || props["날씨"]?.select?.name || null;
      let tmx = props["최고기온"]?.number !== undefined ? props["최고기온"]?.number : props["최고기온"]?.rich_text?.[0]?.plain_text || null;
      let tmn = props["최저기온"]?.number !== undefined ? props["최저기온"]?.number : props["최저기온"]?.rich_text?.[0]?.plain_text || null;
      
      return { id: page.id, title, completed, date, weather, tmx, tmn };
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error("GET Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, date, lat, lng, weather, tmx, tmn } = body;
    
    // 기상 정보 가져오기 (수동 입력이 없을 때만)
    let weatherInfo = null;
    if (!weather && (tmx === undefined || tmn === undefined)) {
      weatherInfo = await getKmaWeather(lat || 37.5665, lng || 126.9780, date);
    }

    const properties: any = {
      "Name": { title: [{ text: { content: title || "새 작업" } }] },
      "일자": { date: { start: date || new Date().toISOString() } },
      "완료여부": { checkbox: false }
    };

    // 날씨 설정
    const weatherVal = weather || (weatherInfo ? weatherInfo.icon : "");
    if (weatherVal) {
      // DB가 rich_text인지 select인지 모르므로 둘 다 시도할 수도 있지만, 
      // 이전 조회 결과(MCP)에 따르면 'rich_text'임.
      properties["날씨"] = { rich_text: [{ text: { content: weatherVal } }] };
    }

    // 최고기온 (Number)
    const tmxVal = tmx !== undefined ? tmx : (weatherInfo ? (weatherInfo as any).tmx : null);
    if (tmxVal !== null && tmxVal !== "-") {
      properties["최고기온"] = { number: parseFloat(String(tmxVal)) };
    }

    // 최저기온 (Number)
    const tmnVal = tmn !== undefined ? tmn : (weatherInfo ? (weatherInfo as any).tmn : null);
    if (tmnVal !== null && tmnVal !== "-") {
      properties["최저기온"] = { number: parseFloat(String(tmnVal)) };
    }

    console.log("POST: Properties to save:", JSON.stringify(properties, null, 2));

    const response = await (notion as any).pages.create({
      parent: { database_id: databaseId },
      properties,
    });

    return NextResponse.json({ success: true, id: response.id });
  } catch (error: any) {
    console.error("POST Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, completed, title, date } = body;
    const properties: any = {};

    if (completed !== undefined) properties["완료여부"] = { checkbox: !!completed };
    if (title !== undefined) properties["Name"] = { title: [{ text: { content: title } }] };
    if (date !== undefined) properties["일자"] = { date: { start: date } };

    await (notion as any).pages.update({ page_id: id, properties });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) throw new Error("ID required");
    await (notion as any).pages.update({ page_id: id, archived: true });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
