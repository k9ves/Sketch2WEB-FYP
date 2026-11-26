import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import TypeScriptWorker from 'monaco-editor/language/typescript/ts.worker?worker'

// Uses the Monaco copy bundled with the app instead of the CDN default of
// @monaco-editor/react, so the code view also works offline. This module is
// only loaded with the code panel (React.lazy), keeping Monaco out of the
// editor's first load.

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    return label === 'typescript' || label === 'javascript'
      ? new TypeScriptWorker()
      : new EditorWorker()
  },
}

const typescript = monaco.typescript

typescript.typescriptDefaults.setCompilerOptions({
  jsx: typescript.JsxEmit.ReactJSX,
  target: typescript.ScriptTarget.ESNext,
  module: typescript.ModuleKind.ESNext,
  allowNonTsExtensions: true,
})

// Imports such as './App.css' or 'react' cannot be resolved inside the
// browser editor, so only syntax errors are shown.
typescript.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: false,
})

loader.config({ monaco })
