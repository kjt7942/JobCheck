import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID!;

export async function GET(request: Request) {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      // You can add sorts or filters here
    });

    // Map Notion properties to friendly task format
    const tasks = response.results.map((page: any) => {
      // Find the name/title property. It could be under "Name", "Title", "title" or whatever the default is.
      // Notion creates a default title property called "Name" or "이름" or "title"
      const titleKeys = Object.keys(page.properties).filter(k => page.properties[k].type === 'title');
      const titleProp = titleKeys.length > 0 ? page.properties[titleKeys[0]] : null;
      const title = titleProp?.title?.[0]?.plain_text || "이름 없는 작업";
      
      return {
        id: page.id,
        title,
        completed: false, // We'll assume false if we can't find a checkbox prop
        date: page.created_time, // fallback to creation time
      };
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error("Notion API Error:", error.body || error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Add page to notion database
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        // We must use 'title' type for the default property
        title: {
          title: [
            {
              text: { content: body.title || "새 작업" },
            },
          ],
        },
      },
    });

    return NextResponse.json({ success: true, id: response.id });
  } catch (error: any) {
    console.error("Notion API Error:", error.body || error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
