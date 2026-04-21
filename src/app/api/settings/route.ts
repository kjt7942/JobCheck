import { NextResponse } from 'next/server';

const NOTION_TOKEN = process.env.NOTION_TOKEN!;
const SETTINGS_DATABASE_ID = process.env.NOTION_SETTINGS_DATABASE_ID!;

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
    const data = await notionFetch(`/databases/${SETTINGS_DATABASE_ID}/query`, 'POST', {
      page_size: 1,
    });

    if (data.results.length === 0) {
      return NextResponse.json({ 
        name: "우리 농장", 
        region: "서울", 
        lat: 37.5665, 
        lng: 126.9780 
      });
    }

    const page = data.results[0];
    const props = page.properties;

    return NextResponse.json({
      id: page.id,
      name: props.농장이름?.rich_text?.[0]?.plain_text || "우리 농장",
      region: props.지역?.rich_text?.[0]?.plain_text || "서울",
      lat: props.위도?.number || 37.5665,
      lng: props.경도?.number || 126.9780,
      weekStartsOn: props.시작요일?.number ?? 1,
      theme: props.테마?.rich_text?.[0]?.plain_text || "light"
    });
  } catch (error: any) {
    console.error("Settings GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { name, region, lat, lng, weekStartsOn, theme } = body;

    const data = await notionFetch(`/databases/${SETTINGS_DATABASE_ID}/query`, 'POST', {
      page_size: 1,
    });

    const properties: any = {
      항목: { title: [{ text: { content: "FarmConfig" } }] },
      농장이름: { rich_text: [{ text: { content: name } }] },
      지역: { rich_text: [{ text: { content: region } }] },
      위도: { number: lat },
      경도: { number: lng },
      시작요일: { number: weekStartsOn ?? 1 },
      테마: { rich_text: [{ text: { content: theme || "light" } }] },
    };

    if (data.results.length > 0) {
      const pageId = data.results[0].id;
      await notionFetch(`/pages/${pageId}`, 'PATCH', { properties });
    } else {
      await notionFetch(`/pages`, 'POST', {
        parent: { database_id: SETTINGS_DATABASE_ID },
        properties,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Settings PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
