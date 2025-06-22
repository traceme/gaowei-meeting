#!/bin/bash

# 生产环境部署脚本
# 用法: ./scripts/deploy.sh [environment] [version]

set -e

# 默认配置
ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-""}
APP_NAME="gaowei-meeting-ai"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# 检查Docker是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    success "Docker environment checked"
}

# 检查环境文件
check_env_file() {
    if [ ! -f ".env" ]; then
        warning ".env file not found, copying from .env.example"
        if [ -f "env.example" ]; then
            cp env.example .env
            warning "Please update .env file with your configuration"
        else
            error "env.example file not found"
        fi
    fi
    success "Environment file checked"
}

# 构建Docker镜像
build_image() {
    log "Building Docker image for $ENVIRONMENT..."
    
    local image_tag="$APP_NAME:$VERSION"
    
    if [ "$ENVIRONMENT" == "development" ]; then
        docker build -f Dockerfile.dev -t "$image_tag" .
    else
        docker build -t "$image_tag" .
    fi
    
    success "Docker image built: $image_tag"
}

# 推送到镜像仓库（如果配置了）
push_image() {
    if [ -n "$DOCKER_REGISTRY" ]; then
        log "Pushing image to registry..."
        local image_tag="$DOCKER_REGISTRY/$APP_NAME:$VERSION"
        docker tag "$APP_NAME:$VERSION" "$image_tag"
        docker push "$image_tag"
        success "Image pushed to registry: $image_tag"
    else
        log "No registry configured, skipping push"
    fi
}

# 停止现有服务
stop_services() {
    log "Stopping existing services..."
    
    if [ "$ENVIRONMENT" == "development" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
    else
        docker-compose down
    fi
    
    success "Services stopped"
}

# 启动服务
start_services() {
    log "Starting services for $ENVIRONMENT..."
    
    if [ "$ENVIRONMENT" == "development" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    else
        docker-compose up -d
    fi
    
    success "Services started"
}

# 健康检查
health_check() {
    log "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
            success "Health check passed"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, waiting..."
        sleep 10
        ((attempt++))
    done
    
    error "Health check failed after $max_attempts attempts"
}

# 显示服务状态
show_status() {
    log "Service status:"
    docker-compose ps
    
    log "\nService logs (last 10 lines):"
    docker-compose logs --tail=10 app
}

# 备份数据
backup_data() {
    if [ "$ENVIRONMENT" == "production" ]; then
        log "Creating data backup..."
        local backup_dir="backups/$(date +'%Y%m%d_%H%M%S')"
        mkdir -p "$backup_dir"
        
        # 备份数据库
        if docker-compose ps | grep -q app; then
            docker-compose exec app cp /app/data/meetings.db "/app/backups/meetings_$(date +'%Y%m%d_%H%M%S').db" || true
        fi
        
        success "Data backup completed: $backup_dir"
    fi
}

# 清理旧的镜像和容器
cleanup() {
    log "Cleaning up old images and containers..."
    
    # 清理退出的容器
    docker container prune -f
    
    # 清理悬空镜像
    docker image prune -f
    
    # 清理旧版本镜像（保留最新的3个版本）
    docker images "$APP_NAME" --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | \
    tail -n +2 | sort -k2 -r | tail -n +4 | awk '{print $1}' | xargs -r docker rmi
    
    success "Cleanup completed"
}

# 主要部署流程
main() {
    log "Starting deployment for $ENVIRONMENT environment (version: $VERSION)"
    
    # 预检查
    check_docker
    check_env_file
    
    # 备份（仅生产环境）
    backup_data
    
    # 构建和部署
    build_image
    push_image
    stop_services
    start_services
    
    # 验证
    health_check
    show_status
    
    # 清理
    cleanup
    
    success "Deployment completed successfully!"
    
    log "Access the application at:"
    log "  - Frontend: http://localhost:5173"
    log "  - API: http://localhost:3000"
    log "  - Health: http://localhost:3000/api/health"
    
    if docker-compose ps | grep -q grafana; then
        log "  - Monitoring: http://localhost:3001 (admin/admin123)"
    fi
}

# 显示使用说明
usage() {
    echo "Usage: $0 [environment] [version]"
    echo ""
    echo "Arguments:"
    echo "  environment    deployment environment (development|production) [default: production]"
    echo "  version        image version tag [default: latest]"
    echo ""
    echo "Environment variables:"
    echo "  DOCKER_REGISTRY    Docker registry URL for pushing images"
    echo ""
    echo "Examples:"
    echo "  $0                          # Deploy to production with latest"
    echo "  $0 development              # Deploy to development"
    echo "  $0 production v1.2.0        # Deploy specific version to production"
    echo ""
}

# 处理命令行参数
case "${1:-}" in
    -h|--help)
        usage
        exit 0
        ;;
    *)
        main
        ;;
esac 