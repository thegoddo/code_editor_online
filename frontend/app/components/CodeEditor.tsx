"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface CodeEditorProps {
  language: string;
  value: string;
  onChange?: (value: string | undefined) => void;
  onMount?: OnMount;
}

export default function CodeEditor({
  language,
  value,
  onChange,
  onMount,
}: CodeEditorProps) {
  const handleEditorMount: OnMount = (editorInstance, monaco) => {
    // Optional editor instance setup (e.g., keybindings, formatters)
    if (onMount) {
      onMount(editorInstance, monaco);
    }
  };

  return (
    <div className="h-full w-full overflow-hidden">
      <Editor
        height="100%"
        width="100%"
        theme="vs-dark"
        language={language === "cpp" ? "cpp" : language}
        value={value}
        onChange={onChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'Fira Code', 'Courier New', monospace",
          fontLigatures: true,
          smoothScrolling: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          cursorBlinking: "smooth",
          renderLineHighlight: "all",
          tabSize: 4,
          formatOnPaste: true,
          formatOnType: true,
        }}
      />
    </div>
  );
}
