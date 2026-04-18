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
      // 속성 정보 로깅 (파일 시스템 활용)
      try {
        const fs = require('fs');
        const path = require('path');
        const debugPath = path.join(process.cwd(), 'scripts', 'notion_debug.txt');
        const propsInfo = Object.entries(page.properties).map(([k, v]: [string, any]) => `${k} (${v.type})`).join(', ');
        fs.appendFileSync(debugPath, `\n[${new Date().toISOString()}] Props: ${propsInfo}`);
      } catch (e) {}

      const titleKeys = Object.keys(page.properties).filter(k => page.properties[k].type === 'title');
      const titlePropKey = titleKeys[0];
      const title = page.properties[titlePropKey]?.title?.[0]?.plain_text || "이름 없는 작업";
      
      const datePropKey = Object.keys(page.properties).find(k => page.properties[k].type === 'date');
      const date = datePropKey ? page.properties[datePropKey]?.date?.start : page.created_time;

      const checkPropKey = Object.keys(page.properties).find(k => page.properties[k].type === 'checkbox');
      const completed = checkPropKey ? page.properties[checkPropKey]?.checkbox : false;
      
      return {
        id: page.id,
        title,
        completed,
        date: date || page.created_time,
      };
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error("Notion API Error (GET):", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let titlePropKey = "Name";
    let datePropKey = "일자";

    try {
      const db: any = await notion.databases.retrieve({ database_id: databaseId });
      const props = db.properties || {};
      const foundTitle = Object.keys(props).find(k => props[k].type === 'title');
      const foundDate = Object.keys(props).find(k => props[k].type === 'date');
      if (foundTitle) titlePropKey = foundTitle;
      if (foundDate) datePropKey = foundDate;
    } catch (e: any) {
      console.warn("Using default props:", e.message);
    }

    const properties: any = {
      [titlePropKey]: { title: [{ text: { content: body.title || "새 작업" } }] },
      [datePropKey]: { date: { start: body.date || new Date().toISOString() } }
    };

    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties,
    });

    return NextResponse.json({ success: true, id: response.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, completed } = body;
    console.log("PATCH Request:", { id, completed });

    if (!id) throw new Error("Page ID is required");
    
    // 1. 해당 페이지 정보를 직접 조회하여 속성 구조 파악 (가장 확실함)
    const page: any = await notion.pages.retrieve({ page_id: id });
    const props = page.properties || {};
    
    // 디버깅: 모든 속성 타입 출력
    console.log("Available properties for page", id, ":");
    Object.keys(props).forEach(k => {
      console.log(`- Property [${k}]: Type [${props[k].type}]`);
    });
    
    // 2. 체크박스 속성 찾기
    const checkPropKey = Object.keys(props).find(k => props[k].type === 'checkbox');
    console.log("Selected checkPropKey:", checkPropKey);
    
    if (!checkPropKey) {
      // 만약 못 찾았다면, 데이터베이스 정보를 한 번 더 확인 (백업)
      try {
        const db: any = await notion.databases.retrieve({ database_id: databaseId });
        const dbProps = db.properties || {};
        const dbCheckKey = Object.keys(dbProps).find(k => dbProps[k].type === 'checkbox');
        if (dbCheckKey) {
           console.log("Found checkPropKey from DB (Fallback):", dbCheckKey);
           await notion.pages.update({
             page_id: id,
             properties: { [dbCheckKey]: { checkbox: !!completed } }
           });
           return NextResponse.json({ success: true });
        }
      } catch (e) {}

      console.error("No checkbox property found in page or database:", id);
      return NextResponse.json({ error: "이 일정에서 '체크박스' 속성을 찾을 수 없습니다. 노션을 확인해 주세요." }, { status: 400 });
    }

    // 3. 찾은 키로 업데이트 실행
    await notion.pages.update({
      page_id: id,
      properties: {
        [checkPropKey]: { checkbox: !!completed }
      }
    });

    console.log("PATCH Success for", id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Notion PATCH Error (Detailed):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const fs = require('fs');
  const path = require('path');
  const debugPath = path.join(process.cwd(), 'scripts', 'notion_debug.txt');

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    fs.appendFileSync(debugPath, `\n[${new Date().toISOString()}] DELETE Attempt for ID: ${id}`);

    if (!id) throw new Error("ID is required");

    // Notion 페이지 보관(Archive) 처리
    const response = await notion.pages.update({
      page_id: id,
      archived: true
    });

    fs.appendFileSync(debugPath, `\n[${new Date().toISOString()}] DELETE Success for ID: ${id}`);
    return NextResponse.json({ success: true, response });
  } catch (error: any) {
    fs.appendFileSync(debugPath, `\n[${new Date().toISOString()}] DELETE Error for ID: ${error.message}`);
    console.error("Notion DELETE Error (Detailed):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
