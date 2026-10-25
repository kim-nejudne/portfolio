import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// Self-hosted, so no render-blocking stylesheet from an origin we do not own.
// These are the Google Fonts files, packaged by @fontsource. Fredoka is the
// display face and Nunito everything else; the variable builds cover every
// weight the UI uses (500–800) in one file each.
import "@fontsource-variable/fredoka/wght.css";
import "@fontsource-variable/nunito/wght.css";
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
