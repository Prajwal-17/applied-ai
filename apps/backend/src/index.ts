import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import dotenv from "dotenv";
import { asc, cosineDistance, desc, eq, sql } from "drizzle-orm";
import express, { type Request, type Response } from "express";
import fs from "fs";
import { db } from "./db/index.js";
import {
  chats,
  itemDetails,
  messages,
  ragChats,
  ragMessages,
} from "./db/schema.js";

dotenv.config();
const app = express();

app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:4173",
      "http://localhost:3000",
    ],
    credentials: true,
  }),
);
const PORT = process.env.PORT;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!PORT) {
  throw new Error("Missing environment variable: PORT");
}

if (!GEMINI_API_KEY) {
  throw new Error("Missing environment variable: GEMINI_API_KEY");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
});

app.get("/", (req: Request, res: Response) => {
  res.json({ status: "success" }).status(200);
});

// app.get("/embeddings-demo", async (req: Request, res: Response) => {
//   try {
//     const dummyVector = Array(1536).fill(0.1);
//     // const embeddingSql = pgvector.toSql(dummyVector);

//     await db.insert(itemDetails).values({
//       embedding: dummyVector,
//     });

//     res.send("Saved");
//   } catch (error) {
//     console.log(error);
//   }
// });

// sse-demo
app.post("/events-demo", async (req: Request, res: Response) => {
  try {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "no-cache");
    res.set("Content-Type", "text/event-stream");
    res.flushHeaders();

    let count = 1;

    const interval = setInterval(() => {
      const stock1Rate = Math.floor(Math.random() * 100000);
      const stock2Rate = Math.floor(Math.random() * 60000);
      res.write(`data: ${JSON.stringify({ stock1Rate })}\n\n`);
      count++;

      if (count > 5) {
        clearInterval(interval);
        res.write("event: end\ndata: finished\n\n");
        res.end();
      }
    }, 2000);
  } catch (error) {
    console.log(error);
  }
});

// get all chats titles
app.get("/api/chats", async (req, res) => {
  try {
    const chatTitles = await db
      .select({
        id: chats.id,
        title: chats.title,
      })
      .from(chats);

    return res.json({ titles: chatTitles }).status(200);
  } catch (error) {
    console.log(error);
    return res.json({ msg: "Something went wrong" }).status(500);
  }
});

// get all rag chats titles
app.get("/api/rag/chats", async (req, res) => {
  try {
    const ragChatTitles = await db
      .select({
        id: ragChats.id,
        title: ragChats.title,
      })
      .from(ragChats);

    return res.status(200).json({ titles: ragChatTitles });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
});

// get chat and its messages
app.get("/api/chat/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!id) {
      return res.json({ msg: "Something went wrong" }).status(400);
    }

    const chatMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, id))
      .orderBy(asc(messages.msgIndex));

    return res.json({ data: { messages: chatMessages } }).status(200);
  } catch (error) {
    console.log(error);
    return res.status(500);
  }
});

// get rag chat and its messages
app.get("/api/rag/chat/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!id) {
      return res.json({ msg: "Something went wrong" }).status(400);
    }

    const ragChatMessages = await db
      .select()
      .from(ragMessages)
      .where(eq(ragMessages.chatId, id))
      .orderBy(asc(ragMessages.msgIndex));

    return res.json({ data: { messages: ragChatMessages } }).status(200);
  } catch (error) {
    console.log(error);
    return res.status(500);
  }
});

// raw apis - gemini
app.post("/api/chat/gemini", async (req: Request, res: Response) => {
  res.setHeader("Content-type", "text/event-stream");
  res.setHeader("Cache-control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  try {
    const { id, prompt } = req.body;

    if (!id) {
      const titleResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction:
            "Generate a concise title for the user given prompt. Provide only the title for this prompt not any explanation or qutotes",
        },
      });

      if (!titleResponse.text) {
        return res.json({ msg: "Title could not be generated" }).status(500);
      }

      const [chat] = await db
        .insert(chats)
        .values({
          title: titleResponse.text,
        })
        .returning();

      const [latestMsgIndex] = await db
        .select({ msgIndex: messages.msgIndex })
        .from(messages)
        .where(eq(messages.chatId, chat!.id))
        .orderBy(desc(messages.msgIndex))
        .limit(1);

      const newMsgIndex = latestMsgIndex?.msgIndex
        ? latestMsgIndex.msgIndex + 1
        : 1;

      await db.insert(messages).values({
        role: "USER",
        msgIndex: newMsgIndex,
        chatId: chat!.id,
        content: prompt,
      });

      let aiResponse = "";

      const response = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      for await (const chunk of response) {
        const text = chunk.text;
        aiResponse += text;
        if (text) {
          // res.write(`event: message\n`);
          res.write(`data:${JSON.stringify({ text })}\n\n`);
        }
      }

      await db.insert(messages).values({
        chatId: chat!.id,
        role: "AI",
        msgIndex: newMsgIndex + 1,
        content: aiResponse,
      });

      res.write(`data:[DONE]\n\n`);
      res.end();
      return;
    }

    const [existingChat] = await db
      .select()
      .from(chats)
      .where(eq(chats.id, id))
      .limit(1);

    if (!existingChat?.id) {
      return res.json({ msg: `Chat does not exist:${id}` }).status(400);
    }

    const [latestMsgIndex] = await db
      .select({ msgIndex: messages.msgIndex })
      .from(messages)
      .where(eq(messages.chatId, existingChat.id))
      .orderBy(desc(messages.msgIndex))
      .limit(1);

    const newMsgIndex = latestMsgIndex?.msgIndex
      ? latestMsgIndex.msgIndex + 1
      : 1;

    await db.insert(messages).values({
      role: "USER",
      msgIndex: newMsgIndex,
      chatId: existingChat.id,
      content: prompt,
    });

    let aiResponse = "";

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    for await (const chunk of response) {
      const text = chunk.text;
      aiResponse += text;
      if (text) {
        // res.write(`event: message\n`);
        res.write(`data:${JSON.stringify({ text })}\n\n`);
      }
    }

    await db.insert(messages).values({
      chatId: existingChat.id,
      role: "AI",
      msgIndex: newMsgIndex + 1,
      content: aiResponse,
    });

    res.write(`data:[DONE]\n\n`);
    res.end();
  } catch (error) {
    console.log((error as Error).message);
    res.status(400);
  }
});

app.post("/api/chat/openrouter", async (req: Request, res: Response) => {
  res.setHeader("Content-type", "text/event-stream");
  res.setHeader("Cache-control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  try {
    const { id, prompt } = req.body;

    if (!id) {
      const titleResponse = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "x-ai/grok-4.1-fast",
            messages: [
              {
                role: "system",
                content:
                  "Generate a concise title for the user given prompt. Provide only the title for this prompt not any explanation or qutotes",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
          }),
        },
      );
      const titleData = await titleResponse.json();
      const newTitleText =
        titleData.choices?.[0]?.message?.content || prompt.slice(0, 30);

      const [chat] = await db
        .insert(chats)
        .values({
          title: newTitleText,
        })
        .returning();

      if (!chat?.id) {
        return res.json({ msg: "New Chat could not create" }).status(500);
      }

      const [latestMsgIndex] = await db
        .select({ msgIndex: messages.msgIndex })
        .from(messages)
        .where(eq(messages.chatId, chat!.id))
        .orderBy(desc(messages.msgIndex))
        .limit(1);

      const newMsgIndex = latestMsgIndex?.msgIndex
        ? latestMsgIndex.msgIndex + 1
        : 1;

      await db.insert(messages).values({
        role: "USER",
        msgIndex: newMsgIndex,
        chatId: chat!.id,
        content: prompt,
      });

      let aiResponse = "";

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "x-ai/grok-4.1-fast",
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            stream: true,
          }),
        },
      );

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error("Response body is not readable");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                aiResponse += content;
                res.write(`data:${JSON.stringify({ text: content })}\n\n`);
              }
            } catch (e) {
              // Ignore invalid JSON
            }
          }
        }
      }

      await db.insert(messages).values({
        chatId: chat.id,
        role: "AI",
        msgIndex: newMsgIndex + 1,
        content: aiResponse,
      });

      res.write(`data:[DONE]\n\n`);
      res.end();
      return;
    }

    const [existingChat] = await db
      .select()
      .from(chats)
      .where(eq(chats.id, id))
      .limit(1);

    if (!existingChat?.id) {
      return res.json({ msg: `Chat does not exist:${id}` }).status(400);
    }

    const prevMessages = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.chatId, existingChat.id))
      .orderBy(asc(messages.msgIndex));

    const openRouterMessages = prevMessages.map((msg: any) => ({
      role: msg.role === "USER" ? "user" : "assistant",
      content: msg.content,
    }));

    const [latestMsgIndex] = await db
      .select({ msgIndex: messages.msgIndex })
      .from(messages)
      .where(eq(messages.chatId, existingChat.id))
      .orderBy(desc(messages.msgIndex))
      .limit(1);

    const newMsgIndex = latestMsgIndex?.msgIndex
      ? latestMsgIndex.msgIndex + 1
      : 1;

    await db.insert(messages).values({
      role: "USER",
      msgIndex: newMsgIndex,
      chatId: existingChat.id,
      content: prompt,
    });

    let aiResponse = "";

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "x-ai/grok-4.1-fast",
          messages: [
            ...openRouterMessages,
            {
              role: "user",
              content: prompt,
            },
          ],
          stream: true,
        }),
      },
    );

    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              aiResponse += content;
              res.write(`data:${JSON.stringify({ text: content })}\n\n`);
            }
          } catch (e) {
            // Ignore invalid JSON
          }
        }
      }
    }

    await db.insert(messages).values({
      chatId: existingChat.id,
      role: "AI",
      msgIndex: newMsgIndex + 1,
      content: aiResponse,
    });

    res.write(`data:[DONE]\n\n`);
    res.end();
  } catch (error) {
    console.log((error as Error).message);
    res.status(400).end();
  }
});

app.post("/api/chat/rag", async (req: Request, res: Response) => {
  res.setHeader("Content-type", "text/event-stream");
  res.setHeader("Cache-control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  try {
    const { id, prompt } = req.body;

    // 1. Perform Vector Search for the prompt first
    const promptEmbed = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: prompt,
    });
    // @ts-ignore
    const queryEmbeddingArray = promptEmbed.embeddings[0]?.values as number[];

    const similarity = sql<number>`1 - (${cosineDistance(itemDetails.embedding, queryEmbeddingArray)})`;

    const embedMatch = await db
      .select({
        id: itemDetails.id,
        textChunk: itemDetails.textChunk,
        similarity: similarity,
      })
      .from(itemDetails)
      .where(sql`${similarity} > 0.5`)
      .orderBy(desc(similarity))
      .limit(4);

    // 2. Build the system prompt using retrieved context
    const systemPrompt = `You are a helpful AI assistant. Answer the user's question using ONLY the provided context blocks below. If the context blocks do not contain the answer, say "I don't know based on the provided documents".\n\nContext blocks:\n${embedMatch.map((match) => match.textChunk).join("\n\n")}`;

    let chatId = id;
    let newMsgIndex = 1;
    let history: any[] = [];

    // 3. Handle Chat lookup or creation
    if (!chatId) {
      // Create a new title based on prompt
      const titleResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction:
            "Generate a concise title for the user given prompt. Provide only the title for this prompt not any explanation or qutotes",
        },
      });
      const chatTitle = titleResponse.text?.trim() || "New RAG Chat";

      const [ragChat] = await db
        .insert(ragChats)
        .values({
          title: chatTitle,
        })
        .returning();

      chatId = ragChat!.id;
    } else {
      const [existingChat] = await db
        .select()
        .from(ragChats)
        .where(eq(ragChats.id, chatId))
        .limit(1);

      if (!existingChat?.id) {
        return res.json({ msg: `Chat does not exist:${chatId}` }).status(400);
      }

      // get history
      const prevMessages = await db
        .select({ role: ragMessages.role, content: ragMessages.content })
        .from(ragMessages)
        .where(eq(ragMessages.chatId, existingChat.id))
        .orderBy(asc(ragMessages.msgIndex));

      history = prevMessages.map((msg) => ({
        role: msg.role === "USER" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

      const [latestMsgIndex] = await db
        .select({ msgIndex: ragMessages.msgIndex })
        .from(ragMessages)
        .where(eq(ragMessages.chatId, existingChat.id))
        .orderBy(desc(ragMessages.msgIndex))
        .limit(1);

      newMsgIndex = latestMsgIndex?.msgIndex ? latestMsgIndex.msgIndex + 1 : 1;
    }

    // 4. Save User Message
    await db.insert(ragMessages).values({
      role: "USER",
      msgIndex: newMsgIndex,
      chatId: chatId,
      content: prompt,
    });

    // 5. Generate Response using Gemini
    let aiResponse = "";
    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [...history, { role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemPrompt,
      },
    });

    for await (const chunk of response) {
      const text = chunk.text;
      aiResponse += text;
      if (text) {
        res.write(`data:${JSON.stringify({ text })}\n\n`);
      }
    }

    // 6. Save AI Response
    await db.insert(ragMessages).values({
      chatId: chatId,
      role: "AI",
      msgIndex: newMsgIndex + 1,
      content: aiResponse,
    });

    res.write(`data:[DONE]\n\n`);
    res.end();
  } catch (error) {
    console.log((error as Error).message);
    res.status(400).end();
  }
});

app.get("/response-demo", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const fileStream = fs.createReadStream("./example.txt", {
    encoding: "utf8",
    highWaterMark: 1024,
  });

  let buffer: any = "";

  try {
    // here only the "highWaterMark" size of chunk is iterated
    for await (const chunk of fileStream) {
      buffer += chunk;

      const parts = buffer.split(/(\s+)/);

      buffer = parts.pop();

      for (const part of parts) {
        res.write(`data: ${JSON.stringify({ content: part })}\n\n`);
        // fake delay
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    // Flush any remaining text in the buffer after the file ends
    if (buffer) {
      res.write(`data: ${JSON.stringify({ content: buffer })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Stream error:", error);
    res.write(`data: ${JSON.stringify({ error: "Failed to read file" })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
