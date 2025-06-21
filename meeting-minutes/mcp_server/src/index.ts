#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs-extra';
import * as path from 'path';
import { KEY_FILES, PROJECT_ANALYSIS, CODE_TEMPLATES, PROJECT_ROOT } from './project-knowledge.js';

const server = new Server(
  {
    name: 'meeting-minutes-dev-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Security function to ensure all operations stay within project root
function validateProjectPath(relativePath: string): string {
  const fullPath = path.resolve(PROJECT_ROOT, relativePath);
  const resolvedProjectRoot = path.resolve(PROJECT_ROOT);
  
  if (!fullPath.startsWith(resolvedProjectRoot)) {
    throw new Error(`Path ${relativePath} is outside project root`);
  }
  
  return fullPath;
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_project_analysis',
        description: 'Get comprehensive analysis of the meeting-minutes project structure and architecture',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'read_key_file',
        description: 'Read content of a key project file (FRONTEND_MAIN_PAGE, TAURI_BACKEND_LIB, WHISPER_SERVER_CPP, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Key identifier for the file to read',
              enum: Object.keys(KEY_FILES),
            },
          },
          required: ['key'],
        },
      },
      {
        name: 'update_key_file',
        description: 'Update content of a key project file',
        inputSchema: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Key identifier for the file to update',
              enum: Object.keys(KEY_FILES),
            },
            content: {
              type: 'string',
              description: 'New content for the file',
            },
          },
          required: ['key', 'content'],
        },
      },
      {
        name: 'read_file',
        description: 'Read any file in the project by relative path',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path from project root (e.g., "frontend/src/app/page.tsx")',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'write_file',
        description: 'Create or update any file in the project',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path from project root (e.g., "frontend/src/components/Upload.tsx")',
            },
            content: {
              type: 'string',
              description: 'File content to write',
            },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'list_directory',
        description: 'List contents of a directory in the project',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path from project root (e.g., "frontend/src/components")',
              default: '.',
            },
          },
          required: [],
        },
      },
      {
        name: 'delete_file',
        description: 'Delete a file in the project',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path from project root',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'create_directory',
        description: 'Create a directory in the project',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path from project root',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'create_react_component',
        description: 'Create a new React component with boilerplate code in the frontend/src/components directory',
        inputSchema: {
          type: 'object',
          properties: {
            componentName: {
              type: 'string',
              description: 'Name of the component in PascalCase (e.g., MyNewComponent)',
              pattern: '^[A-Z][a-zA-Z0-9]*$',
            },
          },
          required: ['componentName'],
        },
      },
      {
        name: 'add_tauri_command',
        description: 'Add a new Tauri command to the Rust backend with automatic registration',
        inputSchema: {
          type: 'object',
          properties: {
            commandName: {
              type: 'string',
              description: 'Name of the command in snake_case (e.g., my_new_command)',
              pattern: '^[a-z_]+$',
            },
          },
          required: ['commandName'],
        },
      },
      {
        name: 'list_key_files',
        description: 'List all available key file identifiers',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_project_analysis':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(PROJECT_ANALYSIS, null, 2),
            },
          ],
        };

      case 'list_key_files':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                availableKeys: Object.keys(KEY_FILES),
                descriptions: Object.fromEntries(
                  Object.entries(KEY_FILES).map(([key, value]) => [key, value.description])
                ),
              }, null, 2),
            },
          ],
        };

      case 'read_key_file':
        const { key } = args as { key: string };
        if (!KEY_FILES[key]) {
          throw new Error(`Unknown file key: ${key}`);
        }
        
        const filePath = KEY_FILES[key].path;
        const content = await fs.readFile(filePath, 'utf-8');
        
        return {
          content: [
            {
              type: 'text',
              text: `File: ${filePath}\nDescription: ${KEY_FILES[key].description}\nLanguage: ${KEY_FILES[key].language}\n\nContent:\n\n${content}`,
            },
          ],
        };

      case 'update_key_file':
        const { key: updateKey, content: newContent } = args as { key: string; content: string };
        if (!KEY_FILES[updateKey]) {
          throw new Error(`Unknown file key: ${updateKey}`);
        }
        
        const updateFilePath = KEY_FILES[updateKey].path;
        await fs.writeFile(updateFilePath, newContent, 'utf-8');
        
        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated ${updateFilePath}`,
            },
          ],
        };

      case 'create_react_component':
        const { componentName } = args as { componentName: string };
        const componentPath = `${PROJECT_ROOT}/frontend/src/components/${componentName}.tsx`;
        
        if (await fs.pathExists(componentPath)) {
          throw new Error(`Component ${componentName} already exists`);
        }
        
        const componentCode = CODE_TEMPLATES.reactComponent(componentName);
        await fs.outputFile(componentPath, componentCode);
        
        return {
          content: [
            {
              type: 'text',
              text: `Successfully created React component ${componentName} at ${componentPath}`,
            },
          ],
        };

      case 'add_tauri_command':
        const { commandName } = args as { commandName: string };
        const libRsPath = KEY_FILES.TAURI_BACKEND_LIB.path;
        
        let libRsContent = await fs.readFile(libRsPath, 'utf-8');
        const commandCode = CODE_TEMPLATES.tauriCommand(commandName);

        // Add the new command function before the run function
        libRsContent = libRsContent.replace(
          /(\n\s*pub fn run\(\) \{)/,
          `\n${commandCode}\n$1`
        );
        
        // Add the command to the invoke_handler
        const handlerRegex = /\.invoke_handler\(tauri::generate_handler!\[([\s\S]*?)\]\)/;
        const match = libRsContent.match(handlerRegex);
        
        if (!match) {
          throw new Error('Could not find invoke_handler in lib.rs');
        }

        const existingCommands = match[1].trim();
        const newHandler = `.invoke_handler(tauri::generate_handler![${existingCommands}, ${commandName}])`;
        libRsContent = libRsContent.replace(handlerRegex, newHandler);
        
        await fs.writeFile(libRsPath, libRsContent, 'utf-8');
        
        return {
          content: [
            {
              type: 'text',
              text: `Successfully added Tauri command ${commandName} to ${libRsPath}`,
            },
          ],
        };

      case 'read_file':
        const { path: readPath } = args as { path: string };
        const fullReadPath = validateProjectPath(readPath);
        
        if (!(await fs.pathExists(fullReadPath))) {
          throw new Error(`File ${readPath} does not exist`);
        }
        
        const fileContent = await fs.readFile(fullReadPath, 'utf-8');
        const stats = await fs.stat(fullReadPath);
        
        return {
          content: [
            {
              type: 'text',
              text: `File: ${readPath}\nSize: ${stats.size} bytes\nModified: ${stats.mtime.toISOString()}\n\nContent:\n\n${fileContent}`,
            },
          ],
        };

      case 'write_file':
        const { path: writePath, content: writeContent } = args as { path: string; content: string };
        const fullWritePath = validateProjectPath(writePath);
        
        await fs.outputFile(fullWritePath, writeContent, 'utf-8');
        
        return {
          content: [
            {
              type: 'text',
              text: `Successfully wrote ${writeContent.length} characters to ${writePath}`,
            },
          ],
        };

      case 'list_directory':
        const { path: dirPath = '.' } = args as { path?: string };
        const fullDirPath = validateProjectPath(dirPath);
        
        if (!(await fs.pathExists(fullDirPath))) {
          throw new Error(`Directory ${dirPath} does not exist`);
        }
        
        const dirStats = await fs.stat(fullDirPath);
        if (!dirStats.isDirectory()) {
          throw new Error(`${dirPath} is not a directory`);
        }
        
        const items = await fs.readdir(fullDirPath, { withFileTypes: true });
        const itemList = items.map(item => ({
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          path: path.join(dirPath, item.name),
        }));
        
        return {
          content: [
            {
              type: 'text',
              text: `Directory listing for ${dirPath}:\n\n${JSON.stringify(itemList, null, 2)}`,
            },
          ],
        };

      case 'delete_file':
        const { path: deletePath } = args as { path: string };
        const fullDeletePath = validateProjectPath(deletePath);
        
        if (!(await fs.pathExists(fullDeletePath))) {
          throw new Error(`File ${deletePath} does not exist`);
        }
        
        await fs.remove(fullDeletePath);
        
        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted ${deletePath}`,
            },
          ],
        };

      case 'create_directory':
        const { path: createPath } = args as { path: string };
        const fullCreatePath = validateProjectPath(createPath);
        
        await fs.ensureDir(fullCreatePath);
        
        return {
          content: [
            {
              type: 'text',
              text: `Successfully created directory ${createPath}`,
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Meeting-Minutes MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
}); 