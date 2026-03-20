- Starting a Docker `pgvector` instance

```
docker run --name applied-ai \
  -e POSTGRES_DB=appliedai \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=ai \
  -p 5432:5432 \
  -v applied-ai-vol:/var/lib/postgresql/data \
  -d pgvector/pgvector:pg16-trixie
```

### **Server Side events**

- https://javascript.info/server-sent-events

- The client has to send `GET` `Content-type: text/event-stream` header
- The response is of header `text/event-stream` & `Transfer-encoding:chunked`
- "data:" -> event must start with `data:`
- "\n\n" -> SSE messages must be separated by a blank line.

- SSE to work first the browser has to send initial req to server, doing the handshake
- The connection created by http event stream is timedout
  - by proxy layer, if there is not response from the server the default behaviour of proxy is to close the connection

- use cases
  - youtube live chat
  - showing progress
  - logging

---

<img alt="uint8Array" src="./attachments/uint8Array.png" width="600" />

<img alt="splitresult" src="./attachments/SplitResult.png" width="600" />
- raw binary byte level data
- Those numbers you're seeing (97, 116, 101, 120, 116, 58, 32, 123, ...) are ASCII/UTF-8 byte values of the incoming text chunks.

### Streams

```js
  // init & set state
    const response = await fetch(
      "url",
      {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-type": "application/json",
        },
        // body: JSON.stringify({ ... })
      },
    );

    if (!response.ok) {
      throw new Error("Something went wrong");
    }

    if (!response.body) {
      throw new Error("Response has no body");
    }

    // response.body is a ReadableStream
    // to read streams & lock it
    const reader = response.body.getReader();
    const decoder = new TextDecoder(); // decode bytes(UTF-8) -> js string

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
          // setState
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
};
```

- stream endpoint

```js
  res.setHeader("Content-type", "text/event-stream");
  res.setHeader("Cache-control", "no-cache");
  res.setHeader("Connection", "keep-alive");

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
```

### Function Calling & Tool Calling

A model does not have live real time data hence it cannot answer like about weather, or access to apis, or execute code. Instead it generates a structured JSON instruction which can then be passed to and external function or backend.
For eg web search, calculator, booking flights, etc
Function calling is a specific mechanism, like a narrowed specific design
Tool is a broad term which consists of many other tools.

### RAG

Rag is a framework that combines information reterival with gen models to give accurate responses. Also instead of
attaching documents each time, only required content chunks are send to llm.

**Document Processing & Chunking** - Upload related docs for further processing and chunking of its contents . Parse pdf to ocr converstion which extracts text images and split into chunks.

**Generate Embeddings** - Then generate embeddings using models like `gemini-embedding-2-preview` or `text-embedding-3-large`.
One model's are not compatible with another model.
Then store the text chunk and embeddings to vector database `pgvector`

**The Rag Pipeline** - The user asks a question about the doc, the prompt is first converted to vector embeddings and then those vector are searched and comapred with the text embedding in the `pgvector` then the matched text chunk are attached to the question and send to llm to get an accurate response

```json
// Eg output of parse data OCR - TEXT
{
  "pages": [{
    "text": "",
    "num": 1
  }, ...]
}

// Parsed Image output
[
  {
    values: [
       -0.016332133,  -0.0043764366, -0.0011324773,  -0.011240026,
      0.00029597108,   0.0014934157,  -0.018807797,   0.013529229,
        0.019723475,   -0.049145423,  -0.020023376,   0.019897161,
       -0.025475917,   -0.016769981,   0.011656811,   0.014576932,
        0.017489318,   0.0019741745,  -0.033542495, -0.0052898847,
        -0.01738165,  -0.0071869395,   0.005816727,  0.0036677625,
       -0.004281101,    0.010329708,  -0.005853738,   0.007902185,
      -0.0031149625,     0.13209803,  -0.016384594,   0.010829647,
        -0.00854677,   0.0034034406,  0.0017756857,   0.015020709,
         0.00256653,    -0.00677215,   0.014306844,  -0.010287376,
        0.009519303,    0.010457309,   0.009206434,   0.012812066,
       -0.010743783, -0.00047993741,  -0.020863462,  -0.005375269,
       0.0116195325,  0.00081031286,  -0.006415543,   0.024154454,
       -0.008800871,   -0.039657805, -0.0070156506,  -0.013774676,
          0.0153811,  -0.0025023571,   0.013820424,   0.018328026,
       -0.025549209,   0.0067770947,  0.0013363153,   0.029920602,
       -0.019204818,   -0.007714158,   0.020704817,  -0.029377379,
        0.026432242,  -0.0097309025,   0.004420867,  0.0077373628,
       -0.025789557,    0.022527738,   0.002122326,  -0.014206396,
       0.0008796896,  -0.0056789797, -0.0058297315, -0.0031754952,
       -0.012731689,    -0.02438119,  -0.022098247, -0.0010674093,
       0.0020459194,  -0.0036232148, 0.00067178026,  -0.009704625,
       0.0076270406,    0.010114799,  -0.023690352,  -0.010317649,
        0.007986447,    0.006744581, -0.0028340402,  -0.015147183,
       -0.028839324,  -0.0044889916,   0.029885976,   0.008165499,
      ... 2972 more items
    ]
  }
]


```
