#!/usr/bin/env node

/**
 * 性能分析脚本
 * 分析构建产物大小、依赖关系和性能指标
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const PACKAGES_DIR = path.join(process.cwd(), 'packages');

function analyzePackage(packageName) {
  console.log(`\n📊 分析包: ${packageName}`);
  
  const packagePath = path.join(PACKAGES_DIR, packageName);
  const packageJsonPath = path.join(packagePath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`❌ 找不到 package.json: ${packageName}`);
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // 分析依赖
  const deps = Object.keys(packageJson.dependencies || {});
  const devDeps = Object.keys(packageJson.devDependencies || {});
  
  console.log(`📦 生产依赖 (${deps.length}):`, deps.slice(0, 5).join(', ') + (deps.length > 5 ? '...' : ''));
  console.log(`🔧 开发依赖 (${devDeps.length}):`, devDeps.slice(0, 5).join(', ') + (devDeps.length > 5 ? '...' : ''));
  
  // 分析构建产物大小
  const distPath = path.join(packagePath, 'dist');
  if (fs.existsSync(distPath)) {
    try {
      const output = execSync(`du -sh ${distPath}`, { encoding: 'utf8' });
      console.log(`📁 构建产物大小: ${output.trim().split('\t')[0]}`);
    } catch (error) {
      console.log(`⚠️  无法获取构建产物大小`);
    }
  } else {
    console.log(`📁 构建产物: 未找到 dist 目录`);
  }
}

function analyzeWorkspace() {
  console.log('🚀 开始分析 Monorepo 性能...\n');
  
  // 分析根目录
  const rootPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const workspaces = rootPackageJson.workspaces || [];
  
  console.log('📋 Workspace 配置:', workspaces);
  
  // 分析各个包
  const packages = fs.readdirSync(PACKAGES_DIR).filter(item => {
    return fs.statSync(path.join(PACKAGES_DIR, item)).isDirectory();
  });
  
  packages.forEach(analyzePackage);
  
  // 分析 node_modules 大小
  console.log('\n📊 依赖分析:');
  try {
    const nodeModulesSize = execSync('du -sh node_modules', { encoding: 'utf8' });
    console.log(`📁 根 node_modules 大小: ${nodeModulesSize.trim().split('\t')[0]}`);
  } catch (error) {
    console.log(`⚠️  无法获取 node_modules 大小`);
  }
  
  // 统计文件数量
  try {
    const fileCount = execSync('find packages -name "*.ts" -o -name "*.tsx" | wc -l', { encoding: 'utf8' });
    console.log(`📄 TypeScript 文件数量: ${fileCount.trim()}`);
  } catch (error) {
    console.log(`⚠️  无法统计文件数量`);
  }
}

function measureBuildTime() {
  console.log('\n⏱️  测量构建时间...');
  
  const startTime = Date.now();
  
  try {
    execSync('pnpm build', { stdio: 'inherit' });
    const endTime = Date.now();
    const buildTime = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`✅ 构建完成，耗时: ${buildTime}s`);
    
    // 保存构建时间记录
    const record = {
      timestamp: new Date().toISOString(),
      buildTime: parseFloat(buildTime),
      packages: fs.readdirSync(PACKAGES_DIR).length
    };
    
    const recordsPath = 'build-performance.json';
    let records = [];
    
    if (fs.existsSync(recordsPath)) {
      records = JSON.parse(fs.readFileSync(recordsPath, 'utf8'));
    }
    
    records.push(record);
    
    // 只保留最近50条记录
    if (records.length > 50) {
      records = records.slice(-50);
    }
    
    fs.writeFileSync(recordsPath, JSON.stringify(records, null, 2));
    console.log(`📝 构建时间已记录到 ${recordsPath}`);
    
  } catch (error) {
    console.error('❌ 构建失败:', error.message);
  }
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--build-time')) {
    measureBuildTime();
  } else {
    analyzeWorkspace();
  }
  
  console.log('\n✨ 分析完成！');
}

main(); 