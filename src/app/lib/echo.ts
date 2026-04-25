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

  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY!;
  const host = process.env.NEXT_PUBLIC_REVERB_HOST || "127.0.0.1";
  const port = Number(process.env.NEXT_PUBLIC_REVERB_PORT || 8080);
  const scheme = process.env.NEXT_PUBLIC_REVERB_SCHEME || "http";
  const cluster = process.env.NEXT_PUBLIC_REVERB_CLUSTER || "mt1"; // ✅ required

  return new Echo({
    broadcaster: "pusher",
    key,
    cluster,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === "https",
    enabledTransports: ["ws", "wss"],
    disableStats: true,
  });
}
