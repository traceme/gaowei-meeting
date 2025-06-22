// AI摘要生成服务 - 支持多提供商容错
import { AppConfig } from '../config/index.js';

export interface SummaryResult {
  text: string;
  model: string;
  provider: string;
  createdAt: string;
}

export interface SummaryProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  generateSummary(text: string, prompt: string): Promise<string>;
}

// Ollama提供商
export class OllamaProvider implements SummaryProvider {
  name = 'ollama';
  private baseURL: string;
  private model: string;

  constructor(config: AppConfig) {
    this.baseURL =
      config.ai.providers.ollama?.baseUrl || 'http://localhost:11434';
    this.model = 'llama3.2:1b'; // 默认模型
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      console.log(`Ollama服务不可用: ${error}`);
      return false;
    }
  }

  async generateSummary(text: string, prompt: string): Promise<string> {
    const request = {
      model: this.model,
      prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 1000,
      },
    };

    const response = await fetch(`${this.baseURL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API错误: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.response;
  }
}

// OpenAI提供商
export class OpenAIProvider implements SummaryProvider {
  name = 'openai';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async generateSummary(text: string, prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API错误: ${response.status} ${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '摘要生成失败';
  }
}

// Claude提供商
export class ClaudeProvider implements SummaryProvider {
  name = 'claude';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async generateSummary(text: string, prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Claude API错误: ${response.status} ${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    return data.content[0]?.text || '摘要生成失败';
  }
}

// AI摘要生成器
export class AISummaryGenerator {
  private providers: SummaryProvider[] = [];
  private readonly AI_TIMEOUT_MS = 1800000; // 30分钟超时

  constructor(config: AppConfig) {
    // 添加Ollama提供商
    this.providers.push(new OllamaProvider(config));

    // 添加OpenAI提供商（如果有API密钥）
    if (config.ai.providers.openai?.apiKey) {
      this.providers.push(
        new OpenAIProvider(config.ai.providers.openai.apiKey)
      );
    }

    // 添加Claude提供商（如果有API密钥）
    if (config.ai.providers.anthropic?.apiKey) {
      this.providers.push(
        new ClaudeProvider(config.ai.providers.anthropic.apiKey)
      );
    }
  }

  async generateSummary(
    transcriptText: string,
    model?: string
  ): Promise<SummaryResult> {
    const prompt = this.createSummaryPrompt(transcriptText);

    let lastError: Error | null = null;

    // 尝试多个AI服务提供商，按优先级顺序
    for (const provider of this.providers) {
      try {
        if (await provider.isAvailable()) {
          console.log(`🤖 尝试使用 ${provider.name} 生成摘要...`);

          const result = await Promise.race([
            provider.generateSummary(transcriptText, prompt),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`${provider.name} 超时`)),
                this.AI_TIMEOUT_MS
              )
            ),
          ]);

          console.log(`✅ ${provider.name} 摘要生成成功`);

          return {
            text: result,
            model: model || 'default',
            provider: provider.name,
            createdAt: new Date().toISOString(),
          };
        } else {
          console.log(`⚠️ ${provider.name} 不可用，跳过`);
        }
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error(`${provider.name} 失败`);
        console.warn(`❌ ${provider.name} 摘要生成失败:`, lastError.message);
        continue; // 尝试下一个提供商
      }
    }

    // 所有提供商都失败了，返回默认摘要
    console.error('所有AI服务提供商都失败了，返回基础摘要');
    const fallbackSummary = this.generateFallbackSummary(transcriptText);

    return {
      text: fallbackSummary,
      model: 'fallback',
      provider: 'fallback',
      createdAt: new Date().toISOString(),
    };
  }

  private createSummaryPrompt(transcriptText: string): string {
    return `你是一个专业的会议摘要助手。请对以下会议转录内容进行智能摘要，提取关键要点、决策和行动项。

⚠️ 重要要求：
- 必须使用简体中文（Simplified Chinese）回答
- 禁止使用繁体中文字符，如：請、會議、決策、時間、參與者等
- 使用大陆地区标准简体中文，如：请、会议、决策、时间、参与者等
- 避免港台用词，使用大陆标准用词

转录内容：
"${transcriptText}"

请严格按以下格式输出摘要（使用简体中文）：

## 📋 会议摘要

### 🎯 关键要点
- [要点1]
- [要点2] 
- [要点3]

### 💡 重要决策
- [决策1]
- [决策2]

### ✅ 行动项
- [行动项1]
- [行动项2]

### 📊 其他信息
- 会议时长：[估算时长]
- 主要参与者：[从内容推断]
- 讨论主题：[主要话题]

请确保全部使用简体中文回答，语言简洁明了，重点突出最重要的信息。`;
  }

  private generateFallbackSummary(transcriptText: string): string {
    // 基础摘要生成逻辑
    const wordCount = transcriptText.length;
    const estimatedDuration = Math.max(1, Math.round(wordCount / 150)); // 估算阅读时间

    // 简单提取前几句作为摘要
    const sentences = transcriptText
      .split(/[。！？.!?]/)
      .filter(s => s.trim().length > 10);
    const keySentences = sentences.slice(0, 3).join('。') + '。';

    return `## 📋 会议摘要（基础版本）

### 🎯 关键内容
${keySentences}

### 📊 会议信息
- 转录文本长度：${wordCount} 字符
- 估算时长：${estimatedDuration} 分钟
- 摘要生成时间：${new Date().toLocaleString('zh-CN')}

*注：此为基础摘要，建议配置AI服务获得更详细的分析结果。*`;
  }

  async getProviderStatus(): Promise<
    Array<{ name: string; available: boolean }>
  > {
    const status = [];
    for (const provider of this.providers) {
      try {
        const available = await provider.isAvailable();
        status.push({ name: provider.name, available });
      } catch (error) {
        status.push({ name: provider.name, available: false });
      }
    }
    return status;
  }
}
