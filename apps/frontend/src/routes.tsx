import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import { AiSDK } from "./pages/AiSDK";
import { Demo } from "./pages/Demo";
import { Home } from "./pages/Home";
import { RawChat } from "./pages/RawChat";
import { Response } from "./pages/Response";
import { Rag } from "./pages/Rag";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/demo",
        element: <Demo />,
      },
      {
        path: "/response-demo",
        element: <Response />,
      },
      {
        path: "/chat",
        element: <RawChat />,
      },
      {
        path: "/aisdk/chat",
        element: <AiSDK />,
      },
      {
        path: "/rag",
        element: <Rag />,
      },
    ],
  },
]);
