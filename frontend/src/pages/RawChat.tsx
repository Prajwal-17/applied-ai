import React, { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  id: string;
  chatId: string;
  msgIndex: number;
  role: string;
  content: string;
};

type Title = {
  id: string;
  title: string;
};

export const RawChat = () => {
  const [promptInput, setPromptInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [titles, setTitles] = useState<Title[]>([]);

  const handleSendMsg = async () => {
    try {
      setLoading(true);
      setMessages((prev) => [
        ...prev,
        {
          id: "",
          chatId: "",
          msgIndex: messages.length + 1,
          role: "USER",
          content: promptInput,
        },
      ]);

      const response = await fetch("http://localhost:3000/api/raw/chat", {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-type": "application/json",
        },
        body: JSON.stringify({
          id: chatId,
          prompt: promptInput,
        }),
      });
      setPromptInput("");

      if (!response.ok) {
        throw new Error("Something went wrong");
      }

      if (!response.body) {
        throw new Error("Response has no body");
      }

      const aiMessageIndex = messages.length + 2;

      setMessages((prev) => [
        ...prev,
        {
          id: "",
          chatId: "",
          msgIndex: aiMessageIndex,
          role: "AI",
          content: "",
        },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let aiResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        // here value is the utf values

        if (done) break;
        // console.log(value);

        // decode returns string
        const chunk = decoder.decode(value, { stream: true });
        // console.log(chunk);

        // split returns array of lines
        const lines = chunk.split("\n");

        for (const line of lines) {
          const jsonStr = line.replace("data:", "");

          if (jsonStr === "[DONE]") break;

          try {
            if (jsonStr === "") {
              continue;
            }
            const data = JSON.parse(jsonStr);
            // console.log(data);

            const newText = data.text;

            aiResponse += newText;
            setMessages((prev) =>
              prev.map((msg, idx) =>
                idx === prev.length - 1 && msg.role === "AI"
                  ? { ...msg, content: aiResponse }
                  : msg,
              ),
            );
          } catch (error) {
            console.log(error);
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: "",
          chatId: "",
          msgIndex: messages.length + 1,
          role: "AI",
          content: aiResponse,
        },
      ]);
      setLoading(false);
    } catch (error) {
      console.log(error);
    }
  };

  const handleCreateNew = () => {
    setMessages([]);
    setChatId(null);
  };

  useEffect(() => {
    async function getChatTitles() {
      const response = await fetch("http://localhost:3000/api/chats", {
        method: "GET",
      });
      if (response.ok) {
        const data = await response.json();
        setTitles(data.titles);
      }
    }

    getChatTitles();
  }, []);

  return (
    <>
      <div className="flex h-screen w-full flex-col bg-black px-4 py-4 text-white">
        <h1 className="mb-4 text-4xl font-semibold">Ai chat app</h1>
        <div>
          {titles.map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                setChatId(item.id);
              }}
              className="group space-x-2"
            >
              <span> =&gt; </span>
              <span className="cursor-pointer group-hover:underline">
                {item.title}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center overflow-hidden">
          <div className="relative flex h-full w-full max-w-3xl flex-col">
            <Chat
              chatId={chatId}
              messages={messages}
              setMessages={setMessages}
            />
            <div>
              <button
                onClick={handleCreateNew}
                className="rounded-xl bg-gray-900 px-4 py-2 text-white hover:cursor-pointer hover:bg-gray-800"
              >
                Create new Chat
              </button>
            </div>
            <div className="flex w-full items-center gap-4 p-2">
              <textarea
                rows={3}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Ask anything"
                className="w-full rounded-xl border border-neutral-600 bg-neutral-900 px-4 py-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                className="cursor-pointer rounded-xl bg-gray-700 p-3 hover:bg-gray-500"
                onClick={handleSendMsg}
              >
                Send
              </button>
            </div>
            {loading && (
              <div className="absolute bottom-30 left-1/2 -translate-1/2 transform text-sm">
                loading ....
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export const Chat = ({
  chatId,
  messages,
  setMessages,
}: {
  chatId: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}) => {
  useEffect(() => {
    const fetchChat = async (chatId: string) => {
      try {
        console.log(chatId);
        const response = await fetch(
          `http://localhost:3000/api/chat/${chatId}`,
          {
            method: "GET",
          },
        );
        if (!response.ok) {
          throw new Error("Something went wrong");
        }
        const data = await response.json();

        setMessages(data.data.messages);
      } catch (error) {
        console.log(error);
      }
    };

    if (chatId) {
      fetchChat(chatId);
    }
  }, [chatId]);

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex w-full ${msg.role === "USER" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2 ${
                msg.role === "USER"
                  ? "bg-gray-800 text-white"
                  : "bg-neutral-900 text-white"
              }`}
            >
              <div className="prose prose-sm prose-invert max-w-none">
                <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
