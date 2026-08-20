"use client"
import dynamic from "next/dynamic";

// Dynamically import client workspace to avoid SSR issues with xterm/Monaco
const CodeWorkspace = dynamic(() => import("./components/CodeWorkSpace"), {
  ssr: false,
});

export default function Page() {
  return (
    <main className="h-screen w-screen">
      <CodeWorkspace />
    </main>
  );
}
