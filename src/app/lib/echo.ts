"use client";

import Echo from "laravel-echo";
import Pusher from "pusher-js";

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

export function makeEcho() {
  if (typeof window !== "undefined") window.Pusher = Pusher;

  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_REVERB_APP_KEY");
  }

  const host = process.env.NEXT_PUBLIC_REVERB_HOST || window.location.hostname || "127.0.0.1";
  const scheme = process.env.NEXT_PUBLIC_REVERB_SCHEME || (window.location.protocol === "https:" ? "https" : "http");
  const port = Number(process.env.NEXT_PUBLIC_REVERB_PORT || (scheme === "https" ? 443 : 80));

  return new Echo({
    broadcaster: "reverb",
    key,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === "https",
    enabledTransports: ["ws", "wss"],
    disableStats: true,
  });
}
