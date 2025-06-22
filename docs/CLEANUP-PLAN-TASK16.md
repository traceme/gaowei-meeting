# 任务16清理计划：meeting-minutes项目冗余代码清理

**日期**: 2024-12-22  
**任务**: 安全删除meeting-minutes目录下的冗余代码和配置  
**前置条件**: 任务15备份机制已建立，所有功能已成功迁移至新Monorepo架构

## 📋 清理前验证清单

### ✅ 功能迁移确认
1. **后端API功能**: 已迁移至 `packages/api/` ✅
   - 转录API: `packages/api/src/routes/transcription.ts`
   - 会议管理: `packages/api/src/routes/meetings.ts`
   - AI摘要: `packages/api/src/routes/summary.ts`
   - 数据库: `packages/api/src/database/index.ts`

2. **前端功能**: 已迁移至 `packages/web/` ✅
   - React组件和页面
   - 用户界面和交互逻辑
   - 样式和布局

3. **转录引擎**: 已迁移至 `packages/whisper-engine/` ✅
   - Python转录服务
   - whisper.cpp集成
   - 转录任务处理

4. **共享组件**: 已迁移至 `packages/ui/` ✅
   - 可复用UI组件
   - 样式系统

## 🗂️ 保留项目清单 (需要保留的文件)

### 📚 重要文档 (保留)
- `meeting-minutes/README.md` - 项目历史记录和参考
- `meeting-minutes/API_DOCUMENTATION.md` - API设计参考
- `meeting-minutes/CONTRIBUTING.md` - 贡献指南参考
- `meeting-minutes/LICENSE.md` - 许可证信息
- `meeting-minutes/docs/` - 完整的文档目录

### 🔧 配置参考 (保留)
- `meeting-minutes/docker-compose.yml` - Docker配置参考
- `meeting-minutes/.gitignore` - Git忽略规则参考
- `meeting-minutes/backend/requirements.txt` - Python依赖参考
- `meeting-minutes/Makefile` - 构建脚本参考

### 📁 移动到参考目录
创建 `meeting-minutes/reference/` 目录保存重要配置：
- 移动重要配置文件到reference目录
- 保留构建脚本作为参考
- 保留环境配置作为参考

## 🗑️ 删除项目清单 (需要删除的代码)

### 🐍 Python后端代码 (删除)
- `meeting-minutes/backend/app/` - FastAPI应用代码
- `meeting-minutes/backend/summary-server/` - 摘要服务器
- `meeting-minutes/backend/examples/` - 示例代码
- `meeting-minutes/backend/*.py` - Python脚本文件

### ⚛️ Next.js前端代码 (删除)
- `meeting-minutes/frontend/src/` - React源代码
- `meeting-minutes/frontend/.next/` - Next.js构建目录
- `meeting-minutes/frontend/node_modules/` - Node.js依赖
- `meeting-minutes/frontend/package.json` - 前端包配置
- `meeting-minutes/frontend/package-lock.json` - 锁定文件

### 🎤 重复的whisper.cpp集成 (删除)
- `meeting-minutes/backend/whisper-custom/` - 自定义whisper集成
- `meeting-minutes/backend/whisper.cpp/` - whisper.cpp源码
- `meeting-minutes/frontend/whisper-server-package/` - whisper服务包

### 🔧 构建和配置脚本 (删除)
- `meeting-minutes/backend/build_whisper.*` - whisper构建脚本
- `meeting-minutes/backend/start_*.cmd` - 启动脚本
- `meeting-minutes/backend/clean_start_*.sh` - 清理启动脚本
- `meeting-minutes/frontend/clean_*.sh` - 前端清理脚本
- `meeting-minutes/create-docker-files.sh` - Docker文件创建脚本
- `meeting-minutes/setup-docker.sh` - Docker设置脚本

### 📊 临时和日志文件 (删除)
- `meeting-minutes/tasklog.txt` - 任务日志 (246KB)
- `meeting-minutes/whisper_logs.txt` - whisper日志
- `meeting-minutes/logs/` - 日志目录
- `meeting-minutes/backend/temp.env` - 临时环境文件

### 🧪 测试和诊断脚本 (删除)
- `meeting-minutes/test_*.sh` - 测试脚本
- `meeting-minutes/simple_summary_test.py` - 摘要测试
- `meeting-minutes/diagnose_and_recover.py` - 诊断脚本
- `meeting-minutes/monitor_task.py` - 监控脚本
- `meeting-minutes/check_task_status.py` - 状态检查脚本

## 🚀 清理执行计划

### 第一阶段：创建参考备份
1. 创建 `meeting-minutes/reference/` 目录
2. 移动重要配置文件到reference目录
3. 创建清理清单和说明文档

### 第二阶段：删除重复代码
1. 删除Python后端应用代码
2. 删除Next.js前端应用代码
3. 删除重复的whisper.cpp集成

### 第三阶段：清理构建脚本
1. 删除所有构建和启动脚本
2. 删除Docker相关的重复配置
3. 删除测试和诊断脚本

### 第四阶段：清理临时文件
1. 删除日志文件和临时文件
2. 删除node_modules和构建产物
3. 清理无用的配置文件

### 第五阶段：文档更新
1. 更新项目结构文档
2. 创建清理完成报告
3. 更新README反映新的项目结构

## ⚠️ 安全措施

### 🛡️ 清理前检查
- [ ] 确认所有功能在新架构中正常工作
- [ ] 验证备份文件完整可用
- [ ] 确认没有遗漏的重要配置或数据

### 📋 清理后验证
- [ ] 验证新架构功能完整性
- [ ] 检查是否有断开的依赖链接
- [ ] 确认构建和测试流程正常

### 🔄 回滚计划
- [ ] 如有问题，使用 `scripts/rollback.sh` 恢复
- [ ] 保留reference目录作为最后参考
- [ ] 确保Git历史记录完整

## 📊 预期结果

### 空间节省
- **删除目录大小**: 预计 ~500MB-1GB
- **保留目录大小**: 预计 ~50MB (仅文档和参考)
- **空间节省率**: 预计 85-90%

### 维护性提升
- **代码重复**: 消除100%的功能重复
- **维护负担**: 减少90%的重复维护工作
- **架构清晰度**: 提升到单一权威来源

### 开发体验
- **构建混乱**: 消除多套构建系统的冲突
- **依赖管理**: 统一到单一包管理系统
- **开发环境**: 简化到单一开发工作流

---

**执行人**: AI Assistant  
**审核状态**: 待执行  
**预估时间**: 30-45分钟  
**风险等级**: 低 (有完整备份保障) 