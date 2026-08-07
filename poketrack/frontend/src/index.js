import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// Self-hosted, so no render-blocking stylesheet from an origin we do not own.
// DotGothic16 is declared by hand in index.css rather than imported from the
// package — it needs a size-adjust the package stylesheet cannot carry.
import "@fontsource-variable/inter/wght.css";
import "@/index.css";
import App from "@/App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
