# Meeting-Minutes MCP Server

这是一个专为 `meeting-minutes` 项目定制的 MCP (Model Context Protocol) 服务器，可以集成到 Claude 桌面版中，为开发工作提供智能自动化支持。

## 功能特性

- 📖 **项目分析**: 获取完整的项目架构分析报告
- 📁 **智能文件操作**: 读取和更新项目核心文件
- ⚛️ **React组件生成**: 自动创建符合项目规范的React组件
- 🦀 **Tauri命令添加**: 自动向Rust后端添加新的Tauri命令
- 🔍 **项目导航**: 快速访问关键文件和目录

## 安装步骤

### 1. 安装依赖

```bash
cd mcp_server
npm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 配置 Claude 桌面版

在你的 Claude 桌面版配置文件中添加以下配置：

**macOS 配置文件路径**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "meeting-minutes-dev": {
      "command": "/absolute/path/to/meeting-minutes/mcp_server/start.sh",
      "args": [],
      "env": {}
    }
  }
}
```

**注意**: 请将 `/absolute/path/to/meeting-minutes` 替换为你的实际项目路径。

### 4. 重启 Claude 桌面版

配置完成后，重启 Claude 桌面版应用，MCP 服务器将自动连接。

## 使用方法

一旦配置完成，你就可以在 Claude 中直接使用以下工具：

### 获取项目分析

```
请使用 get_project_analysis 工具获取项目的完整架构分析
```

### 读取关键文件

```
请使用 read_key_file 工具读取 FRONTEND_MAIN_PAGE 文件的内容
```

### 创建新的React组件

```
请使用 create_react_component 工具创建一个名为 AudioPlayer 的新组件
```

### 添加Tauri命令

```
请使用 add_tauri_command 工具添加一个名为 get_system_info 的新命令
```

### 更新文件内容

```
请使用 update_key_file 工具更新 TAURI_BACKEND_LIB 文件，添加新的功能...
```

## 可用的文件键值

- `FRONTEND_MAIN_PAGE`: 前端主页面 (page.tsx)
- `TAURI_BACKEND_LIB`: Tauri后端核心 (lib.rs)
- `WHISPER_SERVER_CPP`: C++转写服务器 (server.cpp)
- `FRONTEND_PACKAGE_JSON`: 前端包配置 (package.json)

## 开发模式

如果你想要进行开发或调试：

```bash
# 开发模式运行（自动重载）
npm run dev

# 手动构建
npm run build

# 启动生产版本
npm start
```

## 故障排除

### MCP服务器未连接

1. 确保 Claude 桌面版已完全重启
2. 检查配置文件路径是否正确
3. 确保 `start.sh` 脚本有执行权限：`chmod +x start.sh`

### 文件操作失败

1. 确保MCP服务器有读写项目文件的权限
2. 检查项目路径是否正确设置

### 依赖安装问题

如果遇到依赖安装问题，请确保你的Node.js版本 >= 18。

## 技术栈

- **Node.js**: 运行时环境
- **TypeScript**: 开发语言
- **@modelcontextprotocol/sdk**: MCP协议实现
- **fs-extra**: 文件系统操作增强

## 许可证

ISC License
