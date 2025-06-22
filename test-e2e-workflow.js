#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// 测试配置
const CONFIG = {
  whisperUrl: 'http://localhost:8178',
  apiUrl: 'http://localhost:3000',
  ollamaUrl: 'http://localhost:11434',
  testAudioFile: 'packages/whisper-engine/src/whisper-cpp-server/samples/jfk.mp3'
};

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testService(name, url, expectedKeys = []) {
  try {
    log(`\n🔍 测试 ${name}...`, colors.blue);
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok) {
      log(`✅ ${name} 服务正常`, colors.green);
      if (expectedKeys.length > 0) {
        expectedKeys.forEach(key => {
          if (data[key] !== undefined) {
            log(`   - ${key}: ${JSON.stringify(data[key])}`, colors.reset);
          }
        });
      }
      return { success: true, data };
    } else {
      log(`❌ ${name} 服务异常: ${response.status}`, colors.red);
      return { success: false, error: response.status };
    }
  } catch (error) {
    log(`❌ ${name} 连接失败: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

async function testTranscription() {
  try {
    log(`\n🎵 测试音频转录...`, colors.blue);
    
    // 检查测试音频文件
    if (!fs.existsSync(CONFIG.testAudioFile)) {
      log(`❌ 测试音频文件不存在: ${CONFIG.testAudioFile}`, colors.red);
      return { success: false, error: 'Audio file not found' };
    }
    
    // 创建表单数据
    const form = new FormData();
    form.append('audio', fs.createReadStream(CONFIG.testAudioFile));
    form.append('language', 'en');
    
    log(`   上传文件: ${path.basename(CONFIG.testAudioFile)}`, colors.reset);
    
    const response = await fetch(`${CONFIG.whisperUrl}/transcribe`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    const result = await response.json();
    
    if (response.ok && result.text) {
      log(`✅ 转录成功`, colors.green);
      log(`   转录文本: "${result.text.substring(0, 100)}..."`, colors.reset);
      log(`   处理时间: ${result.processing_time || 'N/A'}秒`, colors.reset);
      return { success: true, data: result };
    } else {
      log(`❌ 转录失败: ${JSON.stringify(result)}`, colors.red);
      return { success: false, error: result };
    }
  } catch (error) {
    log(`❌ 转录测试异常: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

async function testSummary(transcriptionText) {
  try {
    log(`\n📝 测试AI摘要生成...`, colors.blue);
    
    const prompt = `请为以下会议转录内容生成简洁的摘要：\n\n${transcriptionText}`;
    
    const response = await fetch(`${CONFIG.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:1b',
        prompt: prompt,
        stream: false
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.response) {
      log(`✅ AI摘要生成成功`, colors.green);
      log(`   摘要内容: "${result.response.substring(0, 150)}..."`, colors.reset);
      return { success: true, data: result };
    } else {
      log(`❌ AI摘要生成失败: ${JSON.stringify(result)}`, colors.red);
      return { success: false, error: result };
    }
  } catch (error) {
    log(`❌ AI摘要测试异常: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

async function testApiIntegration(transcriptionData, summaryData) {
  try {
    log(`\n🔗 测试API集成...`, colors.blue);
    
    // 创建会议记录
    const meetingData = {
      title: `E2E测试会议 - ${new Date().toLocaleString()}`,
      filename: path.basename(CONFIG.testAudioFile),
      transcription: transcriptionData.text,
      summary: summaryData.response,
      duration: transcriptionData.processing_time || 0,
      status: 'completed'
    };
    
    const response = await fetch(`${CONFIG.apiUrl}/api/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meetingData)
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      log(`✅ 会议记录创建成功`, colors.green);
      log(`   会议ID: ${result.data.id}`, colors.reset);
      log(`   标题: ${result.data.title}`, colors.reset);
      return { success: true, data: result.data };
    } else {
      log(`❌ 会议记录创建失败: ${JSON.stringify(result)}`, colors.red);
      return { success: false, error: result };
    }
  } catch (error) {
    log(`❌ API集成测试异常: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

async function runE2ETest() {
  log(`\n🚀 开始端到端功能测试`, colors.yellow);
  log(`=================================`, colors.yellow);
  
  const results = {
    services: {},
    transcription: null,
    summary: null,
    integration: null
  };
  
  // 1. 测试所有服务健康状态
  log(`\n📋 第一阶段: 服务健康检查`, colors.yellow);
  results.services.whisper = await testService('Whisper转录引擎', `${CONFIG.whisperUrl}/health`, ['status', 'model']);
  results.services.api = await testService('后端API服务', `${CONFIG.apiUrl}/api/health`, ['status']);
  results.services.ollama = await testService('Ollama摘要引擎', `${CONFIG.ollamaUrl}/api/tags`, ['models']);
  
  // 检查所有服务是否正常
  const allServicesOk = Object.values(results.services).every(result => result.success);
  if (!allServicesOk) {
    log(`\n❌ 服务检查失败，无法继续测试`, colors.red);
    return results;
  }
  
  // 2. 测试转录功能
  log(`\n📋 第二阶段: 音频转录测试`, colors.yellow);
  results.transcription = await testTranscription();
  
  if (!results.transcription.success) {
    log(`\n❌ 转录测试失败，无法继续后续测试`, colors.red);
    return results;
  }
  
  // 3. 测试摘要功能
  log(`\n📋 第三阶段: AI摘要生成测试`, colors.yellow);
  results.summary = await testSummary(results.transcription.data.text);
  
  if (!results.summary.success) {
    log(`\n❌ 摘要测试失败，无法继续集成测试`, colors.red);
    return results;
  }
  
  // 4. 测试API集成
  log(`\n📋 第四阶段: API集成测试`, colors.yellow);
  results.integration = await testApiIntegration(results.transcription.data, results.summary.data);
  
  // 5. 生成测试报告
  log(`\n📊 测试报告`, colors.yellow);
  log(`=================================`, colors.yellow);
  
  const totalTests = 7; // 3个服务 + 转录 + 摘要 + 集成 + 总体
  let passedTests = 0;
  
  if (results.services.whisper.success) passedTests++;
  if (results.services.api.success) passedTests++;
  if (results.services.ollama.success) passedTests++;
  if (results.transcription?.success) passedTests++;
  if (results.summary?.success) passedTests++;
  if (results.integration?.success) passedTests++;
  
  const successRate = ((passedTests / (totalTests - 1)) * 100).toFixed(1);
  
  log(`\n测试结果统计:`, colors.blue);
  log(`   总测试项: ${totalTests - 1}`, colors.reset);
  log(`   通过测试: ${passedTests}`, colors.green);
  log(`   失败测试: ${(totalTests - 1) - passedTests}`, colors.red);
  log(`   成功率: ${successRate}%`, passedTests === (totalTests - 1) ? colors.green : colors.yellow);
  
  if (passedTests === (totalTests - 1)) {
    log(`\n🎉 恭喜！端到端测试全部通过！`, colors.green);
    log(`   高维会议AI系统核心功能完全正常`, colors.green);
  } else {
    log(`\n⚠️  部分测试失败，请检查相关服务`, colors.yellow);
  }
  
  return results;
}

// 运行测试
if (require.main === module) {
  runE2ETest().catch(error => {
    log(`\n💥 测试执行异常: ${error.message}`, colors.red);
    process.exit(1);
  });
}

module.exports = { runE2ETest, testService, testTranscription, testSummary }; 