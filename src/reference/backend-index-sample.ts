import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import {
  TranscriptionRouter,
  TranscriptionOptions,
} from './transcription-engines';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// 创建转录引擎路由器
const transcriptionRouter = new TranscriptionRouter();

// AI服务配置
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'llama3.2:1b';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;

// AI服务超时配置
const AI_TIMEOUT_MS = 1800000; // 增加到 30 分钟超时

// Ollama工具函数
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    console.log(`Ollama服务不可用: ${error}`);
    return false;
  }
}

// 智能AI摘要生成服务（支持多提供商容错）
async function generateAISummary(
  transcriptText: string,
  model = DEFAULT_MODEL
): Promise<string> {
  const prompt = `请对以下会议转录内容进行智能摘要，提取关键要点、决策和行动项。
请严格使用简体中文回答，不要使用繁体中文字符。
