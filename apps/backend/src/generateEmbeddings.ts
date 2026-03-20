import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { asc, eq } from "drizzle-orm";
import path from "path";
import { PDFParse } from "pdf-parse";
import { fileURLToPath } from "url";
import { db } from "./db/index.js";
import { itemDetails, items } from "./db/schema.js";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function generateEmbeddings() {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error("Missing environment variable: GEMINI_API_KEY");
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const pdfPath = path.join(
      __dirname,
      "../../../attachments/privacy-policy.pdf",
    );

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const pdfMeta = path.parse(pdfPath);
    const parser = new PDFParse({ url: pdfPath });

    const text = await parser.getText();
    // console.log(text);

    const [newItem] = await db
      .insert(items)
      .values({
        name: pdfMeta.name,
        type: pdfMeta.ext,
      })
      .returning({ id: items.id });

    if (!newItem) {
      return;
    }

    await Promise.all(
      text.pages.map(async (item) => {
        await db.insert(itemDetails).values({
          itemId: newItem?.id,
          pageNo: item.num,
          textChunk: item.text,
        });
      }),
    );

    const allChunks = await db
      .select({
        id: itemDetails.id,
        textChunk: itemDetails.textChunk,
      })
      .from(itemDetails)
      .where(eq(itemDetails.itemId, newItem.id))
      .orderBy(asc(itemDetails.pageNo));

    function delay(ms: any) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    for (let chunk of allChunks) {
      async function generateEmbedding(chunk: any) {
        if (!chunk.textChunk) return;
        const response = await ai.models.embedContent({
          model: "gemini-embedding-2-preview",
          contents: chunk.textChunk,
        });

        // @ts-ignore
        const embeddingValues = response.embeddings[0].values;

        const updateItemDetail = await db
          .update(itemDetails)
          .set({
            embedding: embeddingValues,
          })
          .where(eq(itemDetails.id, chunk.id));

        if (!updateItemDetail) {
          console.log("error");
          return;
        }

        if (updateItemDetail.rowCount && updateItemDetail.rowCount <= 0) {
          console.log("Error not updated");
          return;
        }

        console.log("Updated Embeddings in DB");
      }
      await delay(30000);
      await generateEmbedding(chunk);
    }
  } catch (error) {
    console.log(error);
  }
}

generateEmbeddings();
