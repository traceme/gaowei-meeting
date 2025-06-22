#!/usr/bin/env node

// 调试前端上传问题的脚本

const fs = require('fs');
const path = require('path');

// 测试上传功能
async function testUpload() {
  console.log('🔍 开始调试上传功能...');
  
  // 1. 检查后端API健康状态
  console.log('\n1️⃣ 检查后端API状态...');
  try {
    const response = await fetch('http://localhost:3000/api/health');
    const data = await response.json();
    console.log('✅ 后端API正常:', data);
  } catch (error) {
    console.log('❌ 后端API异常:', error.message);
    return;
  }
  
  // 2. 检查前端代理
  console.log('\n2️⃣ 检查前端代理...');
  try {
    const response = await fetch('http://localhost:5173/api/health');
    const data = await response.json();
    console.log('✅ 前端代理正常:', data);
  } catch (error) {
    console.log('❌ 前端代理异常:', error.message);
    console.log('请确保前端服务在运行: pnpm dev');
    return;
  }
  
  // 3. 测试文件上传
  console.log('\n3️⃣ 测试文件上传...');
  const testFile = 'packages/whisper-engine/src/whisper-cpp-server/samples/jfk.mp3';
  
  if (!fs.existsSync(testFile)) {
    console.log('❌ 测试文件不存在:', testFile);
    return;
  }
  
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile));
    
    const response = await fetch('http://localhost:3000/api/transcription/upload', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ 上传成功:', result);
    
    // 4. 测试状态轮询
    console.log('\n4️⃣ 测试状态轮询...');
    const taskId = result.data.taskId;
    
    for (let i = 0; i < 10; i++) {
      try {
        const statusResponse = await fetch(`http://localhost:3000/api/transcription/${taskId}`);
        const statusData = await statusResponse.json();
        
        console.log(`📊 轮询 ${i+1}/10:`, {
          status: statusData.data?.task?.status,
          progress: statusData.data?.task?.progress,
          error: statusData.data?.task?.error
        });
        
        if (statusData.data?.task?.status === 'completed') {
          console.log('🎉 转录完成!');
          break;
        }
        
        if (statusData.data?.task?.status === 'error') {
          console.log('❌ 转录失败:', statusData.data.task.error);
          break;
        }
        
        // 等待2秒再次轮询
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.log(`❌ 轮询失败 ${i+1}:`, error.message);
      }
    }
    
  } catch (error) {
    console.log('❌ 上传失败:', error.message);
  }
}

// 运行测试
testUpload().catch(console.error); 