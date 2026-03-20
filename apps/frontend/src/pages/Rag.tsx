import React, { useEffect, useRef, useState } from "react";
import {
  LuLoader,
  LuMessageSquare as MessageIcon,
  LuPlus as PlusIcon,
  LuSend as SendIcon,
  LuSparkles as SparklesIcon,
} from "react-icons/lu";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
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

const LoadingSpinner = () => (
  <LuLoader className="h-5 w-5 animate-spin text-gray-500" />
);

export const Rag = () => {
  const [promptInput, setPromptInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [titles, setTitles] = useState<Title[]>([]);

  const handleSendMsg = async () => {
    if (!promptInput.trim() || loading) return;

    const currentPrompt = promptInput;
    setPromptInput("");
    setLoading(true);

    try {
      setMessages((prev) => [
        ...prev,
        {
          id: "",
          chatId: "",
          msgIndex: prev.length + 1,
          role: "USER",
          content: currentPrompt,
        },
      ]);

      const response = await fetch(
        `http://localhost:3000/api/rag/chat`,
        {
          method: "POST",
          headers: {
            Accept: "text/event-stream",
            "Content-type": "application/json",
          },
          body: JSON.stringify({
            id: chatId,
            prompt: currentPrompt,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Something went wrong");
      }

      if (!response.body) {
        throw new Error("Response has no body");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: "",
          chatId: "",
          msgIndex: prev.length + 1,
          role: "AI",
          content: "",
        },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let aiResponse = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          const jsonStr = line.replace("data:", "").trim();

          if (jsonStr === "[DONE]") break;

          try {
            if (jsonStr === "") {
              continue;
            }
            const data = JSON.parse(jsonStr);
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
            console.log("Error parsing JSON string:", jsonStr, error);
          }
        }
      }
      setLoading(false);
    } catch (error) {
      console.log(error);
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setMessages([]);
    setChatId(null);
  };

  useEffect(() => {
    async function getChatTitles() {
      try {
        const response = await fetch("http://localhost:3000/api/rag/chats", {
          method: "GET",
        });
        if (response.ok) {
          const data = await response.json();
          setTitles(data.titles);
        }
      } catch (error) {
        console.log("Failed to fetch chat titles", error);
      }
    }

    getChatTitles();
  }, []);

  return (
    <div className="flex h-screen w-full bg-[#212121] font-sans text-gray-100 selection:bg-white/20">
      <div className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-[#171717] transition-all duration-300 md:flex">
        <div className="p-3">
          <button
            onClick={handleCreateNew}
            className="flex w-full items-center gap-3 rounded-lg border border-white/20 bg-transparent p-3 text-sm font-medium transition-colors hover:border-white/40 hover:bg-[#2A2B32]"
          >
            <PlusIcon />
            New RAG Chat
          </button>
        </div>

        <div className="custom-scrollbar mt-4 flex-1 overflow-x-hidden overflow-y-auto p-3 pt-0">
          <div className="mb-3 px-2 text-xs font-semibold text-gray-500">
            Recent RAG Chats
          </div>
          <div className="flex flex-col gap-1">
            {titles.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setChatId(item.id)}
                className={`flex items-center gap-3 rounded-lg p-3 text-left text-sm transition-colors ${
                  chatId === item.id
                    ? "bg-[#2A2B32] text-white"
                    : "text-gray-300 hover:bg-[#2A2B32]"
                }`}
              >
                <div className="shrink-0">
                  <MessageIcon />
                </div>
                <span className="truncate">{item.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col bg-[#212121]">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 md:hidden">
          <button
            onClick={handleCreateNew}
            className="text-gray-300 transition-colors hover:text-white"
          >
            <PlusIcon />
          </button>
          <span className="text-sm font-medium text-gray-300">RAG Chat</span>
          <div className="w-5" />
        </div>

        <div className="custom-scrollbar relative flex-1 overflow-y-auto">
          <Chat chatId={chatId} messages={messages} setMessages={setMessages} />
        </div>

        <div className="w-full shrink-0 bg-linear-to-t from-[#212121] via-[#212121] to-transparent px-4 pt-4 pb-6 md:px-0">
          <div className="relative mx-auto w-full max-w-3xl">
            <div className="relative flex w-full items-center gap-2 rounded-3xl bg-[#2f2f2f] p-2 pr-3 shadow-[0_0_15px_rgba(0,0,0,0.1)] ring-1 ring-white/10 transition-all focus-within:ring-white/30">
              <textarea
                rows={1}
                style={{ minHeight: "44px", maxHeight: "200px" }}
                value={promptInput}
                onChange={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                  setPromptInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMsg();
                  }
                }}
                placeholder="Ask anything about your documents..."
                className="custom-scrollbar w-full resize-none bg-transparent px-4 py-3 text-white placeholder:text-sm placeholder:text-gray-400 focus:outline-none"
              />
              <button
                className={`mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                  promptInput.trim() && !loading
                    ? "bg-white text-black hover:bg-gray-200"
                    : "cursor-not-allowed bg-[#404040] text-gray-500"
                }`}
                onClick={handleSendMsg}
                disabled={!promptInput.trim() || loading}
              >
                {loading ? <LoadingSpinner /> : <SendIcon />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchChat = async (chatId: string) => {
      try {
        const response = await fetch(
          `http://localhost:3000/api/rag/chat/${chatId}`,
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
        console.log("Error fetching chat:", error);
      }
    };

    if (chatId) {
      fetchChat(chatId);
    }
  }, [chatId, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-lg">
          <SparklesIcon />
        </div>
        <h1 className="text-3xl font-semibold text-white/90 md:text-4xl">
          RAG Vector Search Ready
        </h1>
        <p className="mt-4 text-gray-400">Ask questions about your uploaded documents.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col space-y-6 p-4 pb-4 md:p-6">
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`flex w-full ${msg.role === "USER" ? "justify-end" : "justify-start"}`}
        >
          {msg.role === "USER" ? (
            <div className="wrap-break-words max-w-[85%] rounded-3xl bg-[#2f2f2f] px-5 py-3.5 text-[15px] leading-relaxed text-white/90 md:max-w-[75%]">
              {msg.content}
            </div>
          ) : (
            <div className="flex w-full max-w-3xl gap-4">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black">
                <SparklesIcon />
              </div>
              <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl wrap-break-words max-w-none min-w-0 flex-1 text-[15px]">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                >
                  {msg.content || "..."}
                </Markdown>
              </div>
            </div>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
};
