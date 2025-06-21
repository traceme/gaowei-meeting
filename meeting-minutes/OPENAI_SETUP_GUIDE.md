# OpenAI集成使用指南 🚀

## 📋 快速设置步骤

### 1. 获取OpenAI API密钥
1. 访问 [OpenAI Platform](https://platform.openai.com/api-keys)
2. 创建新的API密钥
3. 复制密钥备用

### 2. 配置环境变量
```bash
# 创建环境变量文件
cp .env.example .env

# 编辑 .env 文件，填入你的OpenAI API密钥
nano .env
```

在`.env`文件中添加：
```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. 更新前端配置
在`frontend/src/app/page.tsx`中找到`modelConfig`的初始化（约第81行），修改为：

```typescript
const [modelConfig, setModelConfig] = useState<ModelConfig>({
  provider: 'openai', // 默认使用OpenAI
  model: 'gpt-4o-mini', // 默认使用更便宜的模型
  whisperModel: 'large-v3',
  whisperLanguage: 'auto'
});
```

同时更新`modelOptions`（约第94行）：
```typescript
const modelOptions = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'o1-preview', 'o1-mini', 'gpt-3.5-turbo'],
  ollama: models.map(model => model.name),
  claude: ['claude-3-5-sonnet-latest'],
  groq: ['llama-3.3-70b-versatile'],
};
```

### 4. 重启服务
```bash
# 停止当前服务
docker-compose down

# 重新构建摘要服务
docker-compose build summary-server

# 启动服务（不包含Ollama以节省资源）
docker-compose up -d whisper-server summary-server

# 检查服务状态
docker-compose ps
```

## 🧪 测试AI摘要功能

### 1. 测试服务连接
```bash
# 检查摘要服务健康状态
curl http://localhost:5167/health

# 应该看到类似输出：
# {"database":"connected","openai":"connected","status":"healthy"}
```

### 2. 测试AI摘要生成
```bash
curl -X POST http://localhost:5167/process-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "text": "今天的会议讨论了项目进展。主要决定了下周要完成第一版原型。李明负责前端开发，张华负责后端API。",
    "model": "openai",
    "model_name": "gpt-4o-mini"
  }'

# 获取结果（使用返回的process_id）
curl http://localhost:5167/get-summary/YOUR_PROCESS_ID
```

## 💰 模型选择建议

### 推荐配置（按成本效益排序）：

1. **gpt-4o-mini** ⭐ 推荐
   - 成本最低，速度最快
   - 适合大多数会议摘要任务
   - 性价比最高

2. **gpt-3.5-turbo**
   - 成本较低，速度快
   - 适合简单的摘要任务

3. **gpt-4o**
   - 质量更高，成本中等
   - 适合重要会议或复杂内容

4. **o1-mini**
   - 推理能力强，适合复杂分析
   - 成本较高，处理时间较长

5. **o1-preview**
   - 最高质量，成本最高
   - 仅用于最重要的会议

## 🔧 故障排除

### 问题1：健康检查显示"no_api_key"
**解决方案**：
```bash
# 检查环境变量是否正确设置
docker exec meeting-minutes-summary-server-1 env | grep OPENAI

# 如果没有显示API密钥，重新构建容器
docker-compose down
docker-compose build summary-server
docker-compose up -d
```

### 问题2：API请求失败
**解决方案**：
```bash
# 检查API密钥是否有效
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# 检查余额
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### 问题3：摘要质量不理想
**解决方案**：
1. 尝试更高级的模型（gpt-4o）
2. 检查转录文字质量
3. 确保语言设置正确（中文内容选择中文）

## 📊 使用统计

启用OpenAI API后，你可以在OpenAI Dashboard中查看：
- API使用量
- 成本统计
- 请求日志

## 🔒 安全提醒

1. **API密钥安全**：
   - 不要将API密钥提交到版本控制
   - 定期轮换API密钥
   - 设置使用限制

2. **数据隐私**：
   - 了解OpenAI的数据使用政策
   - 敏感会议内容考虑使用本地模型

## 🚀 高级配置

### 自定义提示词
如需修改摘要格式，编辑`backend/summary-server/app.py`中的`prompt`变量。

### 添加其他提供商
代码已支持扩展到其他AI提供商，如Anthropic Claude或Google Gemini。

---

现在你的会议记录应用已经配置为使用OpenAI API进行AI摘要！🎉