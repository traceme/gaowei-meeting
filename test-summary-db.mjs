import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模拟数据库测试
async function testSummaryFunctionality() {
  console.log('=== 测试Summary功能的API调用 ===\n');

  const baseUrl = 'http://localhost:3000';

  try {
    // 1. 创建测试转录任务（通过API）
    console.log('1. 测试转录任务API...');
    
    // 模拟检查已存在的任务
    const response = await fetch(`${baseUrl}/api/transcription`);
    if (response.ok) {
      const tasks = await response.json();
      console.log(`找到 ${tasks.length} 个现有任务`);
      
      if (tasks.length > 0) {
        const firstTask = tasks[0];
        console.log('第一个任务:', firstTask);
        
        // 2. 检查任务详情
        console.log('\n2. 检查任务详情...');
        const taskResponse = await fetch(`${baseUrl}/api/transcription/${firstTask.id}`);
        if (taskResponse.ok) {
          const taskDetail = await taskResponse.json();
          console.log('任务详情:', JSON.stringify(taskDetail, null, 2));
          console.log('Summary字段:', taskDetail.summary);
          console.log('Summary类型:', typeof taskDetail.summary);
        }

        // 3. 测试摘要生成API
        console.log('\n3. 测试摘要生成API...');
        const summaryResponse = await fetch(`${baseUrl}/api/transcription/${firstTask.id}/summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (summaryResponse.ok) {
          const summaryResult = await summaryResponse.json();
          console.log('摘要生成结果:', summaryResult);
        } else {
          console.log('摘要生成失败:', summaryResponse.status, await summaryResponse.text());
        }

        // 4. 再次检查任务详情，验证摘要是否保存
        console.log('\n4. 验证摘要是否保存...');
        const updatedTaskResponse = await fetch(`${baseUrl}/api/transcription/${firstTask.id}`);
        if (updatedTaskResponse.ok) {
          const updatedTask = await updatedTaskResponse.json();
          console.log('更新后的任务摘要:', updatedTask.summary);
        }
      }
    }

    console.log('\n=== API测试完成 ===');
    
  } catch (error) {
    console.error('API测试出错:', error);
  }
}

// 运行测试
testSummaryFunctionality(); 