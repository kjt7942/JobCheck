import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
const NOTION_TOKEN = process.env.NOTION_TOKEN!;
const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

async function notionFetch(endpoint: string, method: string = 'GET', body?: any) {
  const res = await fetch(`https://api.notion.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Notion API Error');
  }

  return res.json();
}

export async function GET() {
  try {
    const response = await notionFetch(`/databases/${DATABASE_ID}/query`, 'POST', {
      sorts: [{ property: "일자", direction: "descending" }],
    });

    const tasks = response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        title: props.할일?.title?.[0]?.plain_text || "제목 없음",
        date: props.일자?.date?.start || "",
        weather: props.날씨?.rich_text?.[0]?.plain_text || "",
        tmx: props.최고기온?.number ?? null,
        tmn: props.최저기온?.number ?? null,
        completed: props.완료여부?.checkbox || false,
      };
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error("Notion Tasks GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, date, weather, tmx, tmn } = body;

    const properties: any = {
      할일: { title: [{ text: { content: title } }] },
      일자: { date: { start: date } },
    };

    if (weather) {
      properties.날씨 = { rich_text: [{ text: { content: weather } }] };
    }
    if (tmx !== undefined && tmx !== null && tmx !== "") {
      properties.최고기온 = { number: Number(tmx) };
    }
    if (tmn !== undefined && tmn !== null && tmn !== "") {
      properties.최저기온 = { number: Number(tmn) };
    }

    const response = await notionFetch('/pages', 'POST', {
      parent: { database_id: DATABASE_ID },
      properties,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Notion Tasks POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, completed, title, date, weather, tmx, tmn } = body;

    const properties: any = {};
    if (completed !== undefined) {
      properties.완료여부 = { checkbox: completed };
    }
    if (title !== undefined) {
      properties.할일 = { title: [{ text: { content: title } }] };
    }
    if (date !== undefined) {
      properties.일자 = { date: { start: date } };
    }
    if (weather !== undefined) {
      properties.날씨 = { rich_text: [{ text: { content: weather } }] };
    }
    if (tmx !== undefined) {
      properties.최고기온 = { number: tmx ? Number(tmx) : null };
    }
    if (tmn !== undefined) {
      properties.최저기온 = { number: tmn ? Number(tmn) : null };
    }

    const response = await notionFetch(`/pages/${id}`, 'PATCH', {
      properties,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Notion Tasks PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "No ID provided" }, { status: 400 });
    }

    // Notion API에서 삭제는 아카이브(archived) 업데이트로 처리함
    const response = await notionFetch(`/pages/${id}`, 'PATCH', {
      archived: true,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Notion Tasks DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
