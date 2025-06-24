const { DatabaseManager } = require('./packages/api/src/database/index.ts');
const path = require('path');

// 创建数据库连接
const dbPath = path.join(__dirname, 'data', 'test_meeting_minutes.db');
const db = new DatabaseManager(dbPath);

async function testSummaryFunctionality() {
  console.log('=== 测试Summary功能 ===\n');

  try {
    // 1. 创建测试转录任务
    console.log('1. 创建测试转录任务...');
    const task = db.createTranscriptionTask('test-meeting-001', 'test-audio.mp3');
    console.log('创建的任务:', task);

    // 2. 模拟转录完成，添加结果
    console.log('\n2. 模拟转录完成...');
    const transcriptionResult = {
      text: "这是一个测试会议的转录内容。我们讨论了项目进展和下一步计划。",
      duration: 120,
      model: "whisper-1"
    };
    
    const updateSuccess = db.updateTranscriptionTask(task.id, {
      status: 'completed',
      progress: 100,
      result: transcriptionResult
    });
    console.log('转录结果更新成功:', updateSuccess);

    // 3. 添加AI摘要
    console.log('\n3. 添加AI摘要...');
    const summaryData = {
      text: "会议讨论了项目的当前进展和未来计划。主要要点包括完成了阶段性目标，确定了下一步的开发方向。",
      model: "gpt-3.5-turbo",
      created_at: new Date().toISOString()
    };

    const summaryUpdateSuccess = db.updateTranscriptionTask(task.id, {
      summary: summaryData
    });
    console.log('摘要更新成功:', summaryUpdateSuccess);

    // 4. 检索任务，验证数据是否正确保存和解析
    console.log('\n4. 检索任务验证数据...');
    const retrievedTask = db.getTranscriptionTask(task.id);
    console.log('检索到的任务:', JSON.stringify(retrievedTask, null, 2));

    // 5. 验证字段类型
    console.log('\n5. 验证字段类型...');
    console.log('result类型:', typeof retrievedTask.result);
    console.log('summary类型:', typeof retrievedTask.summary);
    console.log('result内容:', retrievedTask.result);
    console.log('summary内容:', retrievedTask.summary);

    // 6. 测试getAllTranscriptionTasks
    console.log('\n6. 测试getAllTranscriptionTasks...');
    const allTasks = db.getAllTranscriptionTasks();
    const testTask = allTasks.find(t => t.id === task.id);
    console.log('通过getAllTranscriptionTasks检索的任务summary:', testTask?.summary);

    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试出错:', error);
  } finally {
    // 清理测试数据
    console.log('\n清理测试数据...');
    db.deleteTranscriptionTask(task.id);
    db.close();
  }
}

// 运行测试
testSummaryFunctionality(); 