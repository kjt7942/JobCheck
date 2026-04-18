import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID!;

export async function GET(request: Request) {
  try {
    // SDK의 query 메서드가 감추어져 있거나 다른 형태로 접근해야 하는 경우를 위해 
    // .databases["query"] 형태 또는 search 우회 로직 사용
    let results: any[] = [];
    
    try {
      // 1. 표준 query 시도
      const queryResponse: any = await (notion as any).databases.query({
        database_id: databaseId,
      });
      results = queryResponse.results;
    } catch (e: any) {
      console.error("Standard Query Failed, trying alternative:", e.message);
      
      // 2. 검색 우회 (이 저장소에 접근 가능한 페이지들)
      const searchResponse: any = await notion.search({
        filter: { value: 'page', property: 'object' },
      });
      
      // 해당 데이터베이스를 부모로 가진 페이지만 필터링
      const cleanDbId = databaseId.replace(/-/g, '');
      results = searchResponse.results.filter((p: any) => {
        const parentId = p.parent?.database_id?.replace(/-/g, '');
        return parentId === cleanDbId;
      });
    }

    const tasks = results.map((page: any) => {
      const titleKeys = Object.keys(page.properties).filter(k => page.properties[k].type === 'title');
      const titlePropKey = titleKeys[0];
      const title = page.properties[titlePropKey]?.title?.[0]?.plain_text || "이름 없는 작업";
      
      const datePropKey = Object.keys(page.properties).find(k => page.properties[k].type === 'date');
      const date = datePropKey ? page.properties[datePropKey]?.date?.start : page.created_time;
      
      return {
        id: page.id,
        title,
        completed: false,
        date: date || page.created_time,
      };
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error("Notion API Final Error (GET):", error.body || error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // DB의 스키마를 동적으로 파악
    const db: any = await notion.databases.retrieve({ database_id: databaseId });
    const props = db.properties || {};
    
    // Title과 Date 속성 이름을 자동으로 찾음
    const titlePropKey = Object.keys(props).find(k => props[k].type === 'title') || "title";
    const datePropKey = Object.keys(props).find(k => props[k].type === 'date');

    if (!datePropKey) {
       throw new Error("노션 데이터베이스에 '날짜' 형식의 속성이 없습니다. 속성을 추가해 주세요.");
    }

    console.log(`Matching Props - Title: [${titlePropKey}], Date: [${datePropKey}]`);

    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        [titlePropKey]: {
          title: [{ text: { content: body.title || "새 작업" } }],
        },
        [datePropKey]: {
          date: { start: body.date || new Date().toISOString() }
        }
      },
    });

    return NextResponse.json({ success: true, id: response.id });
  } catch (error: any) {
    console.error("Notion API Final Error (POST):", error.body || error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
