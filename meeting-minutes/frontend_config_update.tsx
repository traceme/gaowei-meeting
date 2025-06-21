  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: 'openai', // 默认使用OpenAI
    model: 'gpt-4o-mini', // 默认使用更便宜的模型
    whisperModel: 'large-v3',
    whisperLanguage: 'auto'
  });

  const modelOptions = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'o1-preview', 'o1-mini', 'gpt-3.5-turbo'],
    ollama: models.map(model => model.name),
    claude: ['claude-3-5-sonnet-latest'],
    groq: ['llama-3.3-70b-versatile'],
  };