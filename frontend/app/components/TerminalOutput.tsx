"use client";

import { useEffect, useRef } from "react";
import "xterm/css/xterm.css";

interface TerminalProps {
  language: string;
  onSocketReady?: (socket: WebSocket) => void;
}

export default function TerminalOutput({ language, onSocketReady }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    let isMounted = true;
    let socket: WebSocket | null = null;
    let termInstance: any = null;

    const initTerminal = async () => {
      // Dynamically import xterm modules on the client
      const { Terminal } = await import("@xterm/xterm");
      const { AttachAddon } = await import("@xterm/addon-attach");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (!isMounted || !terminalRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontFamily: "monospace",
        fontSize: 14,
        theme: {
          background: "#1e1e1e",
          foreground: "#ffffff",
        },
      });

      termInstance = term;

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      socket = new WebSocket(`ws://localhost:8080/ws/terminal?language=${language}`);

      socket.onopen = () => {
        if (!isMounted || !socket) return;
        term.loadAddon(new AttachAddon(socket));
        term.writeln("\x1b[1;32m Connected to sandbox...\x1b[0m\r\n");
        if (onSocketReady) onSocketReady(socket);
      };

      const handleResize = () => fitAddon.fit();
      window.addEventListener("resize", handleResize);
    };

    initTerminal();

    return () => {
      isMounted = false;
      if (socket) {
        socket.close();
      }
      if (termInstance) {
        termInstance.dispose();
      }
    };
  }, [language]);

  return <div ref={terminalRef} className="h-full w-full overflow-hidden" />;
}
