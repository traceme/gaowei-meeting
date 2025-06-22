import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, '../../');

interface ProjectFiles {
  [key: string]: {
    path: string;
    description: string;
    language: 'typescript-react' | 'rust' | 'cpp' | 'json';
  };
}

export const KEY_FILES: ProjectFiles = {
  FRONTEND_MAIN_PAGE: {
    path: path.join(PROJECT_ROOT, 'frontend/src/app/page.tsx'),
    description:
      'The main page of the application, a large React component managing the meeting UI, state, and interaction with the Tauri backend.',
    language: 'typescript-react',
  },
  TAURI_BACKEND_LIB: {
    path: path.join(PROJECT_ROOT, 'frontend/src-tauri/src/lib.rs'),
    description:
      'The core of the Tauri backend in Rust. Manages audio capture, the transcription pipeline, and communication with the frontend and the C++ server.',
    language: 'rust',
  },
  WHISPER_SERVER_CPP: {
    path: path.join(PROJECT_ROOT, 'backend/whisper-custom/server/server.cpp'),
    description:
      'A high-performance C++ HTTP server that wraps the whisper.cpp library to provide a real-time transcription API.',
    language: 'cpp',
  },
  FRONTEND_PACKAGE_JSON: {
    path: path.join(PROJECT_ROOT, 'frontend/package.json'),
    description:
      'Defines the dependencies and scripts for the Next.js/Tauri frontend application.',
    language: 'json',
  },
};

export const PROJECT_ANALYSIS = {
  keyBusinessProcess: {
    title: 'Real-time Meeting Transcription',
    steps: [
      'User starts recording in the frontend UI (page.tsx).',
      'The command is sent to the Tauri backend (lib.rs).',
      'The Rust backend captures microphone and system audio.',
      'Audio chunks are sent via HTTP to the C++ Whisper server.',
      'The C++ server (server.cpp) transcribes the audio using the Whisper model.',
      'The transcription segments are returned to the Rust backend.',
      "The Rust backend's TranscriptAccumulator assembles full sentences.",
      "A 'transcript-update' event with the full sentence is emitted to the frontend.",
      'The React UI receives the event and displays the new sentence.',
    ],
  },
  projectHighlights: [
    'High-performance stack (Rust, C++) for core functionalities.',
    'Excellent real-time UX with sentence aggregation (TranscriptAccumulator).',
    'Mixed audio recording (mic + system).',
    'Decoupled three-layer architecture (Frontend, App Backend, AI Server).',
    'Local-first AI design for privacy and offline use.',
  ],
  potentialIssues: [
    'Global mutable state in Rust backend (static mut) could be fragile.',
    'Hardcoded URLs for backend services.',
    "Massive 'fat component' in the frontend (page.tsx).",
    'User-facing error handling could be improved.',
    "Tight coupling between Tauri backend and the C++ server's API.",
  ],
};

export const CODE_TEMPLATES = {
  reactComponent: (componentName: string) => `
import React from 'react';

interface ${componentName}Props {
  // Define your component's props here
}

export const ${componentName}: React.FC<${componentName}Props> = (props) => {
  return (
    <div>
      {/* Start your component's JSX here */}
      <h2>${componentName}</h2>
    </div>
  );
};

export default ${componentName};
`,
  tauriCommand: (commandName: string) => `
#[tauri::command]
fn ${commandName}() -> Result<String, String> {
    // Your command logic here
    Ok("Hello from ${commandName}!".to_string())
}
`,
};
