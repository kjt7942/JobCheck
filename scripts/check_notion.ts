
import { Client } from "@notionhq/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID || "";

async function check() {
  console.log("Checking Database:", databaseId);
  try {
    const db = await notion.databases.retrieve({ database_id: databaseId });
    console.log("Properties found in Database:");
    Object.entries(db.properties).forEach(([name, prop]: [string, any]) => {
      console.log(`- ${name} (Type: ${prop.type})`);
    });

    const query = await notion.databases.query({
      database_id: databaseId,
      page_size: 1
    });

    if (query.results.length > 0) {
      console.log("\nSample Page Properties:");
      const page: any = query.results[0];
      Object.entries(page.properties).forEach(([name, prop]: [string, any]) => {
        console.log(`- ${name} (Type: ${prop.type})`);
      });
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

check();
