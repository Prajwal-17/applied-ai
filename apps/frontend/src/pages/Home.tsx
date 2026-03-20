import { Link } from "react-router-dom";

export const Home = () => {
  return (
    <>
      <div className="flex h-screen items-center justify-center">
        <div>
          <h1 className="py-4 text-2xl font-bold">Applied AI Demo</h1>
          <div className="flex justify-between gap-10">
            <div>
              <ul className="space-x-2">
                <li>
                  <Link to="/demo" className="text-blue-500 hover:underline">
                    Stream Demo
                  </Link>
                </li>
                <li>
                  <Link
                    to="/response-demo"
                    className="text-blue-500 hover:underline"
                  >
                    Response Demo
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <ul>
                <li>
                  <Link to="/chat" className="text-blue-500 hover:underline">
                    AI Chat
                  </Link>
                </li>
                <li>
                  <Link
                    to="/aisdk/chat"
                    className="text-blue-500 hover:underline"
                  >
                    Vercel AI SDK Chat
                  </Link>
                </li>
                <li>
                  <Link to="/rag" className="text-green-600 font-semibold hover:underline">
                    RAG Vector Search
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
