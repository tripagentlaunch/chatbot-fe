import type { ReactNode } from "react";
import MeshBackdrop from "./MeshBackdrop";
import "./chat.css";

/** The chat's look (animated mesh, ivory on ink) for the screens before the chat: sign-in, signing in, loading. */
export default function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="tc-root">
      <MeshBackdrop />
      <main className="tc-auth">{children}</main>
    </div>
  );
}
