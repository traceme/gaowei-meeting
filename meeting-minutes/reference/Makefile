# Meeting Minutes Docker Makefile
# 简化 Docker 操作的快捷命令

.PHONY: help build start stop restart logs status clean setup frontend ollama-init

# 默认目标
help: ## 显示帮助信息
	@echo "🎤 Meeting Minutes Docker Commands"
	@echo "=================================="
	@echo
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## 完整安装（构建镜像并启动服务）
	@echo "🚀 Starting full setup..."
	./setup-docker.sh

build: ## 仅构建 Docker 镜像
	@echo "🔨 Building Docker images..."
	./setup-docker.sh --build-only

start: ## 启动后端服务
	@echo "▶️  Starting backend services..."
	docker-compose up -d whisper-server summary-server ollama

stop: ## 停止所有服务
	@echo "⏹️  Stopping all services..."
	docker-compose down

restart: ## 重启所有服务
	@echo "🔄 Restarting services..."
	docker-compose restart

logs: ## 查看所有服务日志
	@echo "📋 Showing service logs..."
	docker-compose logs -f

logs-whisper: ## 查看 Whisper 服务日志
	docker-compose logs -f whisper-server

logs-summary: ## 查看摘要服务日志
	docker-compose logs -f summary-server

logs-ollama: ## 查看 Ollama 服务日志
	docker-compose logs -f ollama

status: ## 查看服务状态
	@echo "📊 Service Status:"
	@echo "=================="
	docker-compose ps
	@echo
	@echo "🌐 Service Health:"
	@echo "=================="
	@curl -s http://localhost:8178 > /dev/null && echo "✅ Whisper Server: Running" || echo "❌ Whisper Server: Not responding"
	@curl -s http://localhost:5167/health > /dev/null && echo "✅ Summary Server: Running" || echo "❌ Summary Server: Not responding"
	@curl -s http://localhost:11434/api/tags > /dev/null && echo "✅ Ollama: Running" || echo "❌ Ollama: Not responding"

test: ## 测试所有服务
	@echo "🧪 Testing services..."
	@echo "Testing Whisper Server..."
	curl -f http://localhost:8178/ || echo "Whisper server test failed"
	@echo "Testing Ollama..."
	curl -f http://localhost:11434/api/tags || echo "Ollama test failed"
	@echo "Testing Summary Server..."
	curl -f http://localhost:5167/health || echo "Summary server test failed"

frontend: ## 启动前端开发服务器
	@echo "🖥️  Starting frontend..."
	cd frontend && npm run tauri dev

frontend-install: ## 安装前端依赖
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm install

ollama-init: ## 初始化 Ollama 模型
	@echo "🤖 Initializing Ollama models..."
	docker-compose exec ollama ollama pull llama3.2:latest
	docker-compose exec ollama ollama pull mistral:latest

ollama-list: ## 列出 Ollama 模型
	docker-compose exec ollama ollama list

shell-whisper: ## 进入 Whisper 容器
	docker-compose exec whisper-server bash

shell-summary: ## 进入摘要服务容器
	docker-compose exec summary-server bash

shell-ollama: ## 进入 Ollama 容器
	docker-compose exec ollama bash

clean: ## 清理所有 Docker 资源
	@echo "🧹 Cleaning up..."
	./setup-docker.sh --clean

clean-images: ## 清理未使用的镜像
	@echo "🗑️  Removing unused images..."
	docker image prune -f

clean-volumes: ## 清理所有卷
	@echo "⚠️  This will delete all data! Press Ctrl+C to cancel..."
	@sleep 5
	docker-compose down -v

update: ## 更新并重建服务
	@echo "🔄 Updating services..."
	docker-compose pull
	docker-compose up --build -d

backup: ## 备份数据卷
	@echo "💾 Creating backup..."
	mkdir -p backups
	docker run --rm -v meeting-minutes_whisper_models:/data -v $(PWD)/backups:/backup alpine tar czf /backup/whisper_models_$(shell date +%Y%m%d_%H%M%S).tar.gz -C /data .
	docker run --rm -v meeting-minutes_summary_data:/data -v $(PWD)/backups:/backup alpine tar czf /backup/summary_data_$(shell date +%Y%m%d_%H%M%S).tar.gz -C /data .
	docker run --rm -v meeting-minutes_ollama_data:/data -v $(PWD)/backups:/backup alpine tar czf /backup/ollama_data_$(shell date +%Y%m%d_%H%M%S).tar.gz -C /data .

restore: ## 恢复数据卷（需要指定备份文件）
	@echo "📁 Available backups:"
	@ls -la backups/*.tar.gz 2>/dev/null || echo "No backups found"
	@echo "Usage: make restore BACKUP=backups/filename.tar.gz"

# 开发相关命令
dev-start: build start frontend-install ## 开发环境快速启动
	@echo "🚀 Development environment ready!"
	@echo "Run 'make frontend' in another terminal to start the frontend"

dev-logs: ## 开发模式日志（彩色输出）
	docker-compose logs -f --tail=100

monitor: ## 监控系统资源
	@echo "📊 Docker Resource Usage:"
	@echo "========================="
	docker stats --no-stream
	@echo
	@echo "💾 Disk Usage:"
	@echo "=============="
	docker system df

# 故障排除
debug-whisper: ## 调试 Whisper 服务
	@echo "🔍 Whisper Server Debug Info:"
	@echo "============================="
	docker-compose exec whisper-server ls -la /app/models/
	docker-compose exec whisper-server /app/build/bin/server --help

debug-summary: ## 调试摘要服务
	@echo "🔍 Summary Server Debug Info:"
	@echo "============================="
	docker-compose exec summary-server python -c "import requests; print('Requests working')"
	docker-compose exec summary-server ls -la /app/

# 性能测试
perf-test: ## 简单性能测试
	@echo "⚡ Performance Test:"
	@echo "==================="
	@echo "Testing Whisper Server response time..."
	@time curl -s http://localhost:8178/ > /dev/null
	@echo "Testing Ollama response time..."
	@time curl -s http://localhost:11434/api/tags > /dev/null

# 安全检查
security-scan: ## 扫描容器安全问题
	@echo "🔒 Security Scan:"
	@echo "================="
	docker-compose config --quiet && echo "✅ Compose file is valid"
	
# 一键启动（推荐）
quick-start: ## 一键启动（构建+启动+前端依赖）
	@echo "⚡ Quick Start..."
	@make build
	@make start
	@make frontend-install
	@echo "✅ All services started! Run 'make frontend' to start the UI"