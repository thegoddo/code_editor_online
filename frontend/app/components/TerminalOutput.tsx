"use client";

import { useEffect, useRef } from "react";

interface TerminalProps {
  language: string;
  onSocketReady?: (socket: WebSocket) => void;
  onTerminalReady?: (focus: () => void) => void;
}

export default function TerminalOutput({
  language,
  onSocketReady,
  onTerminalReady,
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const onSocketReadyRef = useRef(onSocketReady);
  const onTerminalReadyRef = useRef(onTerminalReady);

  useEffect(() => {
    onSocketReadyRef.current = onSocketReady;
    onTerminalReadyRef.current = onTerminalReady;
  }, [onSocketReady, onTerminalReady]);

  useEffect(() => {
    if (!terminalRef.current) return;

    let isMounted = true;
    let socket: WebSocket | null = null;
    let termInstance: { dispose: () => void } | null = null;

    const initTerminal = async () => {
      // Dynamically import xterm modules on the client
      const { Terminal } = await import("@xterm/xterm");
      const { AttachAddon } = await import("@xterm/addon-attach");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (!isMounted || !terminalRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        convertEol: true,
        cursorStyle: "bar",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 13,
        lineHeight: 1.35,
        scrollback: 3000,
        allowTransparency: true,
        theme: {
          background: "#111318",
          foreground: "#d7dae0",
          cursor: "#64d8a4",
          cursorAccent: "#111318",
          selectionBackground: "#264f78",
          black: "#111318",
          red: "#ff7b72",
          green: "#7ee787",
          yellow: "#f2cc60",
          blue: "#79c0ff",
          magenta: "#d2a8ff",
          cyan: "#56d4dd",
          white: "#d7dae0",
          brightBlack: "#636a75",
          brightWhite: "#ffffff",
        },
      });

      termInstance = term;
      onTerminalReadyRef.current?.(() => term.focus());

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      socket = new WebSocket(
        `ws://localhost:8080/ws/terminal?language=${language}`,
      );

      socket.onopen = () => {
        if (!isMounted || !socket) return;
        term.loadAddon(new AttachAddon(socket));
        term.writeln("\x1b[1;32m● Connected to sandbox\x1b[0m");
        term.writeln(
          "\x1b[90m  Terminal output is live and interactive.\x1b[0m\r\n",
        );
        onSocketReadyRef.current?.(socket);
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
