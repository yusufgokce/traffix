import type { Msg } from "./protocol";
import { supabase } from "./supabase";

const NAME = "traffix-sim";

// Same-browser tabs talk over BroadcastChannel. With Supabase configured,
// messages also go over a Realtime channel so a real phone can join.
export function openChannel(onMessage: (msg: Msg) => void) {
  const local = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(NAME) : null;
  if (local) local.onmessage = (e) => onMessage(e.data as Msg);

  const sb = supabase();
  const remote = sb?.channel(NAME, { config: { broadcast: { self: false } } });
  remote?.on("broadcast", { event: "msg" }, ({ payload }) => onMessage(payload as Msg)).subscribe();

  return {
    send(msg: Msg) {
      local?.postMessage(msg);
      remote?.send({ type: "broadcast", event: "msg", payload: msg });
    },
    close() {
      local?.close();
      if (remote) sb?.removeChannel(remote);
    },
    remote: Boolean(remote),
  };
}
