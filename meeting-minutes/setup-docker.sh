#!/bin/bash

# Meeting Minutes Docker 部署脚本
# 适用于 macOS

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 is not installed"
        return 1
    fi
    return 0
}

# 检查 Docker 环境
check_docker() {
    log_info "Checking Docker environment..."
    
    if ! check_command docker; then
        log_error "Docker is not installed. Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
        exit 1
    fi
    
    if ! check_command docker-compose; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # 检查 Docker 是否运行
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker Desktop"
        exit 1
    fi
    
    log_success "Docker environment is ready"
}

# 检查项目结构
check_project_structure() {
    log_info "Checking project structure..."
    
    required_files=(
        "docker-compose.yml"
        "backend/whisper-custom"
        "backend/summary-server"
        "frontend"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -e "$file" ]; then
            log_error "Missing required file/directory: $file"
            exit 1
        fi
    done
    
    log_success "Project structure is valid"
}

# 创建环境配置
setup_environment() {
    log_info "Setting up environment configuration..."
    
    if [ ! -f ".env.docker" ]; then
        if [ -f ".env.docker.example" ]; then
            cp .env.docker.example .env.docker
            log_success "Created .env.docker from example"
        else
            log_warning ".env.docker.example not found, creating basic configuration"
            cat > .env.docker << EOF
WHISPER_MODEL=ggml-base.en.bin
WHISPER_THREADS=4
WHISPER_PORT=8178
SUMMARY_PORT=5167
OLLAMA_PORT=11434
FRONTEND_PORT=3118
EOF
            log_success "Created basic .env.docker"
        fi
    else
        log_info ".env.docker already exists"
    fi
}

# 创建必要的目录
create_directories() {
    log_info "Creating necessary directories..."
    
    directories=(
        "backend/whisper-custom/models"
        "backend/summary-server/data"
        "logs"
    )
    
    for dir in "${directories[@]}"; do
        mkdir -p "$dir"
        log_info "Created directory: $dir"
    done
    
    log_success "Directories created"
}

# 下载 Whisper 模型（可选）
download_models() {
    log_info "Checking Whisper models..."
    
    model_dir="backend/whisper-custom/models"
    base_model="$model_dir/ggml-base.en.bin"
    
    if [ ! -f "$base_model" ]; then
        log_warning "Whisper model not found locally"
        echo "The model will be downloaded during Docker build process"
        echo "If you want to download it manually now, run:"
        echo "  cd $model_dir"
        echo "  wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
    else
        log_success "Whisper model found: $base_model"
    fi
}

# 构建 Docker 镜像
build_images() {
    log_info "Building Docker images..."
    
    # 只构建后端服务镜像
    docker-compose build whisper-server summary-server
    
    log_success "Docker images built successfully"
}

# 启动服务
start_services() {
    log_info "Starting backend services..."
    
    # 启动后端服务
    docker-compose up -d whisper-server summary-server ollama
    
    log_success "Backend services started"
    
    # 等待服务启动
    log_info "Waiting for services to be ready..."
    sleep 10
    
    # 检查服务状态
    check_services
}

# 检查服务状态
check_services() {
    log_info "Checking service status..."
    
    services=(
        "http://localhost:8178|Whisper Server"
        "http://localhost:11434/api/tags|Ollama"
        "http://localhost:5167/health|Summary Server"
    )
    
    for service in "${services[@]}"; do
        url=$(echo $service | cut -d'|' -f1)
        name=$(echo $service | cut -d'|' -f2)
        
        if curl -s -f "$url" > /dev/null 2>&1; then
            log_success "$name is running"
        else
            log_warning "$name is not responding (this might be normal during startup)"
        fi
    done
}

# 显示后续步骤
show_next_steps() {
    echo
    log_success "Docker backend services are starting up!"
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 Next Steps:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    echo "1. Check service status:"
    echo "   docker-compose ps"
    echo
    echo "2. View service logs:"
    echo "   docker-compose logs -f whisper-server"
    echo "   docker-compose logs -f summary-server"
    echo
    echo "3. Test services:"
    echo "   curl http://localhost:8178/"
    echo "   curl http://localhost:11434/api/tags"
    echo
    echo "4. Start the frontend locally:"
    echo "   cd frontend"
    echo "   npm install"
    echo "   npm run tauri dev"
    echo
    echo "5. Initialize Ollama models (optional):"
    echo "   docker-compose exec ollama ollama pull llama3.2:latest"
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔗 Service URLs:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "• Whisper Server:  http://localhost:8178"
    echo "• Summary Server:  http://localhost:5167"
    echo "• Ollama API:      http://localhost:11434"
    echo "• Frontend:        Will open automatically with Tauri"
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🛠️  Useful Commands:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "• Stop services:   docker-compose down"
    echo "• Restart:         docker-compose restart"
    echo "• View logs:       docker-compose logs -f [service-name]"
    echo "• Shell access:    docker-compose exec [service-name] bash"
    echo
}

# 清理函数
cleanup() {
    log_info "Cleaning up..."
    docker-compose down
}

# 显示帮助信息
show_help() {
    echo "Meeting Minutes Docker Setup Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --build-only   Only build images, don't start services"
    echo "  --start-only   Only start services (assumes images are built)"
    echo "  --clean        Stop services and remove containers/volumes"
    echo "  --logs         Show service logs"
    echo
    echo "Examples:"
    echo "  $0                    # Full setup (build and start)"
    echo "  $0 --build-only       # Only build Docker images"
    echo "  $0 --start-only       # Only start services"
    echo "  $0 --clean            # Clean up everything"
    echo "  $0 --logs             # Show logs"
}

# 显示日志
show_logs() {
    log_info "Showing service logs..."
    docker-compose logs -f
}

# 清理所有资源
clean_all() {
    log_info "Cleaning up all Docker resources..."
    docker-compose down -v --remove-orphans
    docker system prune -f
    log_success "Cleanup completed"
}

# 主函数
main() {
    echo "🎤 Meeting Minutes Docker Setup"
    echo "==============================="
    echo
    
    # 解析命令行参数
    case "${1:-}" in
        -h|--help)
            show_help
            exit 0
            ;;
        --build-only)
            check_docker
            check_project_structure
            setup_environment
            create_directories
            download_models
            build_images
            log_success "Build completed. Run '$0 --start-only' to start services."
            exit 0
            ;;
        --start-only)
            check_docker
            start_services
            show_next_steps
            exit 0
            ;;
        --clean)
            clean_all
            exit 0
            ;;
        --logs)
            show_logs
            exit 0
            ;;
        "")
            # 默认：完整安装
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
    
    # 完整安装流程
    check_docker
    check_project_structure
    setup_environment
    create_directories
    download_models
    build_images
    start_services
    show_next_steps
}

# 捕获中断信号
trap cleanup INT TERM

# 执行主函数
main "$@"