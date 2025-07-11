# AI摘要功能测试指南

## 测试步骤

### 1. 准备测试音频文件
- 准备一个短的音频文件（建议1-2分钟）
- 确保音频质量清晰，内容有意义

### 2. 上传并转录
1. 访问 http://localhost:3000
2. 上传音频文件
3. 等待转录完成
4. **验证点1**: 转录完成后，AI摘要应该自动生成并保存到数据库

### 3. 查看历史记录
1. 点击"历史记录"页面
2. 找到刚才的转录任务
3. 点击"查看详情"
4. **验证点2**: 页面应该跳转到结果页面

### 4. 验证AI摘要显示
1. 在结果页面，点击"AI摘要"标签
2. **验证点3**: 应该立即显示之前自动生成的摘要内容（不显示"生成AI摘要"按钮）
3. **验证点4**: 应该显示"重新生成"和"复制"按钮

### 5. 测试重新生成功能
1. 点击"重新生成"按钮
2. **验证点5**: 应该显示加载状态
3. **验证点6**: 生成完成后显示新的摘要内容

## 预期行为

### 自动摘要生成
- 转录完成后，MeetingManager会自动调用AI摘要生成
- 摘要会保存到数据库的summary字段
- 这个过程在后台进行，不阻塞用户界面

### 前端显示逻辑
- 如果数据库中已有摘要：显示摘要内容 + "重新生成"按钮
- 如果数据库中没有摘要：显示"生成AI摘要"按钮

### 数据流
1. 音频上传 → 转录服务
2. 转录完成 → MeetingManager.updateTranscriptionTask
3. 自动触发 → generateAndSaveSummary
4. AI摘要生成 → 保存到数据库
5. 用户查看详情 → API返回包含摘要的任务数据
6. 前端显示 → 立即显示保存的摘要

## 故障排除

### 如果摘要没有自动生成
1. 检查后端日志，查看是否有错误信息
2. 确认AI模型配置是否正确
3. 检查API密钥是否有效

### 如果前端显示有问题
1. 检查浏览器控制台是否有错误
2. 确认API响应是否包含summary字段
3. 检查TranscriptionDetail组件的逻辑

### 如果数据库操作失败
1. 检查数据库schema是否正确
2. 确认summary字段是否存在
3. 查看数据库操作的日志 