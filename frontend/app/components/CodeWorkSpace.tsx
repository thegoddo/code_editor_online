"use client";

import { useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import dynamic from "next/dynamic";
import type { editor } from "monaco-editor";
import CodeEditor from "./CodeEditor";

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
  const [isSocketReady, setIsSocketReady] = useState<boolean>(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

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
        command = `stty -echo; cat << 'EOF' > main.py\n${code}\nEOF\nclear; python3 main.py; stty echo\n`;
        break;
      case "javascript":
        command = `stty -echo; cat << 'EOF' > index.js\n${code}\nEOF\nclear; node index.js; stty echo\n`;
        break;
      case "cpp":
        command = `stty -echo; cat << 'EOF' > /tmp/main.cpp\n${code}\nEOF\nclear; g++ -O2 /tmp/main.cpp -o /tmp/main && /tmp/main; stty echo\n`;
        break;
      case "java":
        command = `stty -echo; cat << 'EOF' > Main.java\n${code}\nEOF\nclear; javac Main.java && java Main; stty echo\n`;
        break;
      default:
        command = `echo "Language ${language} not configured."\n`;
        break;
    }

    socketRef.current.send(command);
  };

  return (
    <div className="h-screen w-screen bg-[#1e1e1e] text-white overflow-hidden">
      <Group direction="horizontal">
        {/* Left Side: AI Assistant & Notes */}
        <Panel defaultSize={25} minSize={15}>
          <div className="p-4 h-full border-r border-neutral-800 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-semibold mb-2">AI Assistant</h2>
              <p className="text-xs text-neutral-400">
                Write code on the editor, hit{" "}
                <span className="text-emerald-400 font-mono">Run Code</span>,
                and interact directly in the pseudo-terminal.
              </p>
            </div>
            <div className="text-[11px] text-neutral-500 font-mono">
              Sandbox Status: {isSocketReady ? "Connected" : "Connecting..."}
            </div>
          </div>
        </Panel>

        <Separator className="w-1 bg-neutral-800 hover:bg-emerald-500 cursor-col-resize transition-colors" />

        {/* Right Side: Editor & Integrated Terminal */}
        <Panel defaultSize={75} minSize={40}>
          <Group direction="vertical">
            {/* Top Half: Code Editor */}
            <Panel defaultSize={60} minSize={30}>
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center px-4 py-2 bg-[#252526] border-b border-neutral-800">
                  <div className="flex items-center space-x-3">
                    <label className="text-xs font-mono text-neutral-400">
                      Language:
                    </label>
                    <select
                      value={language}
                      onChange={(e) => handleLanguageChange(e.target.value)}
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
                      className={`text-xs font-semibold py-1.5 px-3 rounded transition-colors ${
                        isSocketReady
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                          : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                      }`}
                    >
                      {isSocketReady ? "Run Code" : "Connecting..."}
                    </button>
                    <button
                      onClick={() => alert("Submission received!")}
                      className="bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-semibold py-1.5 px-3 rounded transition-colors"
                    >
                      Submit
                    </button>
                  </div>
                </div>

                <div className="flex-1 w-full overflow-hidden">
                  <CodeEditor
                    language={language}
                    value={DEFAULT_SNIPPETS[language] || ""}
                    onMount={handleEditorDidMount}
                  />
                </div>
              </div>
            </Panel>

            <Separator className="h-1 bg-neutral-800 hover:bg-emerald-500 cursor-row-resize transition-colors" />

            {/* Bottom Half: Interactive Terminal */}
            <Panel defaultSize={40} minSize={20}>
              <div className="h-full w-full bg-[#1e1e1e] p-2 flex flex-col">
                <div className="text-[11px] uppercase tracking-wider text-neutral-400 mb-1 font-mono">
                  Interactive Terminal Output
                </div>
                <div className="flex-1 w-full overflow-hidden">
                  <TerminalOutput
                    key={language}
                    language={language}
                    onSocketReady={handleSocketReady}
                  />
                </div>
              </div>
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}
