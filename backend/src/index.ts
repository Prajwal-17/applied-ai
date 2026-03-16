import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import fs from "fs";
import { prisma } from "./lib/prisma.js";

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

// get chat and its messages
app.get("/api/chat/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    if (!id) {
      return res.json({ msg: "Something went wrong" }).status(400);
    }

    const chat = await prisma.chats.findFirst({
      where: {
        id: id,
      },
      select: {
        messages: true,
      },
    });

    return res.json({ data: chat }).status(200);
  } catch (error) {
    console.log(error);
    return res.status(500);
  }
});

// raw apis - gemini
app.post("/api/raw/chat", async (req: Request, res: Response) => {
  res.setHeader("Content-type", "text/event-stream");
  res.setHeader("Cache-control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  try {
    const { id, prompt } = req.body;

    // list models
    // const models = await ai.models.list();

    const existingChat = await prisma.chats.findFirst({
      where: {
        id: id,
      },
    });

    if (!existingChat?.title) {
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

      const chat = await prisma.chats.create({
        data: {
          title: titleResponse.text,
        },
      });
    }

    const latestMsgIndex = await prisma.messages.findFirst({
      where: {
        id: id,
      },
      orderBy: {
        msgIndex: "desc",
      },
      select: { msgIndex: true },
    });

    const newMsgIndex = latestMsgIndex?.msgIndex
      ? latestMsgIndex?.msgIndex + 1
      : 1;

    const newUserMsg = await prisma.messages.create({
      data: {
        role: "USER",
        msgIndex: newMsgIndex,
        chatId: "8c12caea-938c-4b92-a2d0-02d125e2c698",
        content: prompt,
      },
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

    const newMessage = await prisma.messages.create({
      data: {
        chatId: "8c12caea-938c-4b92-a2d0-02d125e2c698",
        role: "AI",
        msgIndex: newMsgIndex + 1,
        content: aiResponse,
      },
    });

    res.write(`data:[DONE]\n\n`);
    res.end();
  } catch (error) {
    console.log((error as Error).message);
    res.status(400);
  }
});

app.post("/api/openrouter/chat", async (req: Request, res: Response) => {
  res.setHeader("Content-type", "text/event-stream");
  res.setHeader("Cache-control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  try {
    const { chatId, prompt } = req.body;

    let newChatId;
    if (!chatId) {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_KEY}`,
            // "HTTP-Referer": "<YOUR_SITE_URL>", // Optional. Site URL for rankings on openrouter.ai.
            // "X-OpenRouter-Title": "<YOUR_SITE_NAME>", // Optional. Site title for rankings on openrouter.ai.
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
      const newTitle = await response.json();

      const newChat = await prisma.chats.create({
        data: {
          title: newTitle.choices[0].message.content,
        },
      });

      if (!newChat.id) {
        return res.json({ msg: "New Chat could not create" }).status(500);
      }
      newChatId = newChat.id;
    }

    const activeChatId = chatId || newChatId;

    const prevMessages = await prisma.messages.findMany({
      where: {
        chatId: activeChatId,
      },
      select: {
        role: true,
        content: true,
      },
      orderBy: {
        msgIndex: "asc",
      },
    });

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_KEY}`,
          // "HTTP-Referer": "<YOUR_SITE_URL>", // Optional. Site URL for rankings on openrouter.ai.
          // "X-OpenRouter-Title": "<YOUR_SITE_NAME>", // Optional. Site title for rankings on openrouter.ai.
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "x-ai/grok-4.1-fast",
          messages: [
            ...prevMessages,
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
    console.log(reader);
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const lineEnd = buffer.indexOf("\n");
        if (lineEnd === -1) break;
        const line = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0].delta.content;
            if (content) {
              // console.log(content);
              res.write(`data:${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            console.log("errr", e);
            // Ignore invalid JSON
          }
        }
      }
    }

    res.write(`data:[DONE]\n\n`);
    res.end();
  } catch (error) {
    console.log(error);
    return res.status(500);
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
