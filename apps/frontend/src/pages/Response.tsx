import { useEffect, useState } from "react";

export const Response = () => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("http://localhost:3000/response-demo", {
          method: "GET",
          // headers: {
          //   "Content-type": "application/json",
          // },
          // body: JSON.stringify({ prompt: "Hi hello" }),
        });

        if (!response.body) return;

        const stream = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          // a stream returns done & value
          const { done, value } = await stream.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop()!;

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;

            const json = line.replace("data:", "").trim();
            try {
              const parsed = JSON.parse(json);
              console.log(parsed);
              setData((prev) => [...prev, parsed]);
            } catch (error) {
              console.log(error);
            }
          }
        }
      } catch (error) {
        console.log(error);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    console.log(data);
  }, [data]);

  return (
    <>
      <div>Response Streaming Demo</div>
      {data.map((item, index) => (
        <span key={index}>{item.content}</span>
      ))}
    </>
  );
};
