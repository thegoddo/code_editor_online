"use client";

import { useEffect, useRef, useState } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import dynamic from "next/dynamic";
import type { editor } from "monaco-editor";
import {
  CircleHelp,
  Code2,
  Play,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import CodeEditor from "./CodeEditor";
import AiChatSidebar from "./AiChatSidebar";

// Dynamically import TerminalOutput to disable server-side rendering
const TerminalOutput = dynamic(() => import("./TerminalOutput"), {
  ssr: false,
});

const DEFAULT_SNIPPETS: Record<string, string> = {
  python: `print("Hello from Python Sandbox!")\nfor i in range(5):\n    print(f"Index: {i}")`,
  javascript: `console.log("Hello from Node.js Sandbox!");\nfor (let i = 0; i < 5; i++) {\n    console.log("Index:", i);\n}`,
  cpp: `#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++ Sandbox!" << std::endl;\n    return 0;\n}`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java Sandbox!");\n    }\n}`,
};

export default function CodeWorkspace() {
  const [language, setLanguage] = useState<string>("python");
  const [code, setCode] = useState<string>(DEFAULT_SNIPPETS.python);
  const [isSocketReady, setIsSocketReady] = useState<boolean>(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const aiPanelRef = usePanelRef();
  const terminalFocusRef = useRef<(() => void) | null>(null);

  const handleEditorDidMount = (
    editorInstance: editor.IStandaloneCodeEditor,
  ) => {
    editorRef.current = editorInstance;
  };

  const handleSocketReady = (socket: WebSocket) => {
    socketRef.current = socket;
    setIsSocketReady(true);
  };

  const handleLanguageChange = (newLang: string) => {
    setIsSocketReady(false);
    setLanguage(newLang);
  };

  const runCode = () => {
    if (!editorRef.current || !socketRef.current) return;
    if (socketRef.current.readyState !== WebSocket.OPEN) return;

    const code = editorRef.current.getValue();

    let command = "";
    switch (language) {
      case "python":
        command = `stty -echo; printf '\\033[1;36m▶ Running Python 3\\033[0m\\n'; cat << 'EOF' > main.py\n${code}\nEOF\nclear; printf '\\033[1;36m▶ Running Python 3\\033[0m\\n\\n'; python3 main.py; printf '\\n\\033[1;32m✓ Process finished\\033[0m\\n'; stty echo\n`;
        break;
      case "javascript":
        command = `stty -echo; cat << 'EOF' > index.js\n${code}\nEOF\nclear; printf '\\033[1;36m▶ Running Node.js\\033[0m\\n\\n'; node index.js; printf '\\n\\033[1;32m✓ Process finished\\033[0m\\n'; stty echo\n`;
        break;
      case "cpp":
        command = `stty -echo; cat << 'EOF' > /tmp/main.cpp\n${code}\nEOF\nclear; printf '\\033[1;36m▶ Compiling C++ with GCC\\033[0m\\n\\n'; g++ -O2 -fdiagnostics-color=always /tmp/main.cpp -o /tmp/main && /tmp/main; printf '\\n\\033[1;32m✓ Process finished\\033[0m\\n'; stty echo\n`;
        break;
      case "java":
        command = `stty -echo; cat << 'EOF' > Main.java\n${code}\nEOF\nclear; printf '\\033[1;36m▶ Compiling Java 21\\033[0m\\n\\n'; javac Main.java && java Main; printf '\\n\\033[1;32m✓ Process finished\\033[0m\\n'; stty echo\n`;
        break;
      default:
        command = `echo "Language ${language} not configured."\n`;
        break;
    }

    socketRef.current.send(command);
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey)
        return;

      if (event.key === "'") {
        event.preventDefault();
        runCode();
      } else if (event.key === "`") {
        event.preventDefault();
        terminalFocusRef.current?.();
      } else if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        if (aiPanelRef.current?.isCollapsed()) {
          aiPanelRef.current.expand();
        } else {
          aiPanelRef.current?.collapse();
        }
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  return (
    <div className="h-screen w-screen bg-[#1e1e1e] text-white overflow-hidden">
      <Group orientation="horizontal">
        {/* Left Side: AI Assistant & Notes */}
        <Panel
          panelRef={aiPanelRef}
          defaultSize={25}
          minSize={15}
          collapsedSize={0}
          collapsible
        >
          <AiChatSidebar currentCode={code} currentLanguage={language} />
        </Panel>

        <Separator className="w-1 bg-neutral-800 hover:bg-emerald-500 cursor-col-resize transition-colors" />

        {/* Right Side: Editor & Integrated Terminal */}
        <Panel defaultSize={75} minSize={40}>
          <Group orientation="vertical">
            {/* Top Half: Code Editor */}
            <Panel defaultSize={60} minSize={30}>
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center px-4 py-2 bg-[#252526] border-b border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-300">
                      <Code2 className="h-3.5 w-3.5 text-emerald-400" />
                      Editor
                    </div>
                    <label className="text-[10px] uppercase tracking-wider text-neutral-500">
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => {
                        handleLanguageChange(e.target.value);
                        setCode(DEFAULT_SNIPPETS[e.target.value] || "");
                      }}
                      className="bg-neutral-800 text-xs text-neutral-200 border border-neutral-700 rounded px-2 py-1 outline-none"
                    >
                      <option value="python">Python 3</option>
                      <option value="javascript">JavaScript (Node.js)</option>
                      <option value="cpp">C++ (GCC)</option>
                      <option value="java">Java 21</option>
                    </select>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={runCode}
                      disabled={!isSocketReady}
                      title="Run code (Ctrl + ')"
                      className={`text-xs font-semibold py-1.5 px-3 rounded transition-colors ${
                        isSocketReady
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                          : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Play className="h-3 w-3" />
                        {isSocketReady ? "Run Code" : "Connecting..."}
                      </span>
                    </button>
                    <button
                      onClick={() => setIsShortcutHelpOpen(true)}
                      className="bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-semibold py-1.5 px-3 rounded transition-colors flex items-center gap-1.5"
                    >
                      <CircleHelp className="w-3.5 h-3.5" />
                      Shortcut Help
                    </button>
                  </div>
                </div>

                <div className="flex-1 w-full overflow-hidden">
                  <CodeEditor
                    language={language}
                    value={code}
                    onChange={(value) => setCode(value ?? "")}
                    onMount={handleEditorDidMount}
                  />
                </div>
              </div>
            </Panel>

            <Separator className="h-1 bg-neutral-800 hover:bg-emerald-500 cursor-row-resize transition-colors" />

            {/* Bottom Half: Interactive Terminal */}
            <Panel defaultSize={40} minSize={20}>
              <div className="h-full w-full bg-[#111318] p-2 flex flex-col">
                <div className="flex items-center justify-between border-b border-neutral-800 px-2 pb-2 mb-1">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-neutral-300 font-mono">
                    <TerminalIcon className="h-3.5 w-3.5 text-cyan-400" />
                    Terminal
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isSocketReady ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400 animate-pulse"}`}
                    />
                    {isSocketReady ? "LIVE" : "CONNECTING"}
                    <span className="text-neutral-700">Ctrl + `</span>
                  </div>
                </div>
                <div className="flex-1 w-full overflow-hidden">
                  <TerminalOutput
                    key={language}
                    language={language}
                    onSocketReady={handleSocketReady}
                    onTerminalReady={(focus) => {
                      terminalFocusRef.current = focus;
                    }}
                  />
                </div>
              </div>
            </Panel>
          </Group>
        </Panel>
      </Group>

      {isShortcutHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
              <button
                onClick={() => setIsShortcutHelpOpen(false)}
                title="Close shortcut help"
                className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs text-neutral-300">
              <div className="flex items-center justify-between">
                <span>Run code</span>
                <kbd className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-neutral-200">
                  Ctrl + &apos;
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Focus terminal</span>
                <kbd className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-neutral-200">
                  Ctrl + `
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Toggle AI chatbar</span>
                <kbd className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-neutral-200">
                  Ctrl + B
                </kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
