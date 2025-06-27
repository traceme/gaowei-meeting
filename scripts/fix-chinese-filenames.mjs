#!/usr/bin/env node
/**
 * 中文文件名修复工具
 * 修复数据库中存储的乱码文件名
 */

import Database from '../packages/api/node_modules/better-sqlite3/lib/index.js';
import { join } from 'path';

const DB_PATH = 'data/meeting_minutes.db';

// 中文文件名乱码修复映射
const filenameFixMap = new Map([
  ['ææ°è¶å¿', '最新趋势'],
  ['äº§åä¼è®®', '产品会议'], 
  ['å®¢æ·è®¿è°', '客户访谈'],
  ['éååè®­', '销售培训'],
  ['å›¢éä¼é', '团队会议'],
  // 可以根据需要添加更多映射
]);

function fixChineseFilename(filename) {
  if (!filename) return filename;
  
  // 策略1: 如果已经包含正确中文，直接返回
  if (/[\u4e00-\u9fa5]/.test(filename) && !filenameFixMap.has(filename)) {
    return filename;
  }
  
  // 策略2: 使用映射表修复已知乱码
  let fixed = filename;
  for (const [garbled, correct] of filenameFixMap) {
    fixed = fixed.replace(garbled, correct);
  }
  
  if (fixed !== filename) {
    console.log(`修复文件名: ${filename} -> ${fixed}`);
    return fixed;
  }
  
  // 策略3: 尝试其他解码方法（如果需要）
  try {
    // 这里可以添加其他解码逻辑
    return filename;
  } catch (error) {
    console.warn('文件名修复失败:', filename, error);
    return filename;
  }
}

function main() {
  console.log('🔧 开始修复数据库中的中文文件名...');
  
  try {
    const db = new Database(DB_PATH);
    
    // 查询所有需要修复的转录任务
    const tasks = db.prepare('SELECT id, filename FROM transcription_tasks WHERE filename LIKE ?').all('%ææ%');
    
    console.log(`找到 ${tasks.length} 个需要修复的文件名`);
    
    if (tasks.length === 0) {
      console.log('✅ 没有发现需要修复的文件名');
      db.close();
      return;
    }
    
    const updateStmt = db.prepare('UPDATE transcription_tasks SET filename = ? WHERE id = ?');
    
    let fixedCount = 0;
    
    for (const task of tasks) {
      const originalFilename = task.filename;
      const fixedFilename = fixChineseFilename(originalFilename);
      
      if (fixedFilename !== originalFilename) {
        updateStmt.run(fixedFilename, task.id);
        fixedCount++;
        console.log(`✅ 修复任务 ${task.id}: ${originalFilename} -> ${fixedFilename}`);
      }
    }
    
    console.log(`🎉 修复完成！共修复 ${fixedCount} 个文件名`);
    
    db.close();
    
  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行修复
main();
