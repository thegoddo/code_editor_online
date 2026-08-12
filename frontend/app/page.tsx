"use client";
import { Group, Panel, Separator } from "react-resizable-panels";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useRef } from "react";
import type { editor } from "monaco-editor";

export default function Home() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = (editorInstance) => {
    editorRef.current = editorInstance;
  };

  return (
    <Group>
      <Panel defaultSize="50%">
        <p>This is an AI window</p>
      </Panel>

      <Separator />

      <Panel>
        <Editor
          height="90vh"
          defaultLanguage="javascript"
          defaultValue="// some comment"
          onMount={handleEditorDidMount}
        />
        <button className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
          Run
        </button>
        <button className="bg-white-500 font-bold py-2 px-4 rounded">
          Submit
        </button>
      </Panel>
    </Group>
  );
}
