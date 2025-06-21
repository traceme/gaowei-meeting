#!/bin/bash

# 🔥 Meeting Minutes - 强制重建脚本
# 用于彻底清理和重建Whisper服务器，解决缓存和状态问题

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_header() {
    echo -e "\n${BLUE}🔥 $1${NC}"
    echo "=============================================="
}

# 检查Docker是否运行
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker未运行，请先启动Docker"
        exit 1
    fi
    log_success "Docker运行正常"
}

# 主函数
main() {
    log_header "Meeting Minutes 强制重建脚本"
    
    # 检查Docker
    check_docker
    
    # 步骤1: 停止所有服务
    log_header "步骤1: 停止所有服务"
    if docker-compose ps | grep -q "Up"; then
        log_info "停止docker-compose服务..."
        docker-compose down
        log_success "服务已停止"
    else
        log_info "服务已经停止"
    fi
    
    # 步骤2: 删除Whisper相关镜像
    log_header "步骤2: 清理Whisper镜像"
    
    WHISPER_IMAGES=$(docker images | grep "whisper" | awk '{print $1":"$2}' || true)
    MEETING_IMAGES=$(docker images | grep "meeting-minutes.*whisper" | awk '{print $1":"$2}' || true)
    
    if [ -n "$WHISPER_IMAGES" ] || [ -n "$MEETING_IMAGES" ]; then
        log_info "找到以下Whisper相关镜像:"
        echo "$WHISPER_IMAGES"
        echo "$MEETING_IMAGES"
        
        # 删除镜像
        if [ -n "$WHISPER_IMAGES" ]; then
            echo "$WHISPER_IMAGES" | xargs docker rmi -f 2>/dev/null || true
        fi
        if [ -n "$MEETING_IMAGES" ]; then
            echo "$MEETING_IMAGES" | xargs docker rmi -f 2>/dev/null || true
        fi
        
        log_success "Whisper镜像已清理"
    else
        log_info "未找到Whisper相关镜像"
    fi
    
    # 步骤3: 清理悬空镜像和构建缓存
    log_header "步骤3: 清理Docker缓存"
    
    log_info "清理悬空镜像..."
    docker image prune -f >/dev/null 2>&1 || true
    
    log_info "清理构建缓存..."
    docker builder prune -f >/dev/null 2>&1 || true
    
    log_success "Docker缓存已清理"
    
    # 步骤4: 重新构建whisper-server
    log_header "步骤4: 重新构建whisper-server"
    
    log_info "开始构建whisper-server (无缓存)..."
    if docker-compose build --no-cache whisper-server; then
        log_success "whisper-server构建成功"
    else
        log_error "whisper-server构建失败"
        exit 1
    fi
    
    # 步骤5: 启动服务
    log_header "步骤5: 启动服务"
    
    log_info "启动docker-compose服务..."
    if docker-compose up -d; then
        log_success "服务启动成功"
    else
        log_error "服务启动失败"
        exit 1
    fi
    
    # 步骤6: 等待服务就绪
    log_header "步骤6: 等待服务就绪"
    
    log_info "等待whisper-server启动..."
    sleep 5
    
    # 检查健康状态
    MAX_RETRIES=12
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -s http://localhost:8178/health >/dev/null 2>&1; then
            log_success "whisper-server已就绪"
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        log_info "等待中... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 5
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        log_warning "whisper-server可能未完全就绪，请手动检查"
    fi
    
    # 步骤7: 验证状态
    log_header "步骤7: 验证服务状态"
    
    if command -v python3 >/dev/null 2>&1; then
        if [ -f "check_task_status.py" ]; then
            log_info "检查任务状态..."
            python3 check_task_status.py || true
        else
            log_info "未找到check_task_status.py，跳过状态检查"
        fi
    else
        log_info "未找到python3，跳过状态检查"
    fi
    
    # 显示运行状态
    log_info "当前运行的容器:"
    docker-compose ps
    
    # 完成
    log_header "🎉 重建完成!"
    
    echo -e "\n${GREEN}✨ 强制重建成功完成! ✨${NC}"
    echo -e "${BLUE}📊 服务状态:${NC}"
    echo -e "  • Whisper Server: http://localhost:8178/health"
    echo -e "  • 前端: http://localhost:3118"
    echo ""
    echo -e "${YELLOW}💡 提示:${NC}"
    echo -e "  • 如果还有问题，请查看日志: docker logs meeting-minutes-whisper-server-1"
    echo -e "  • 检查任务状态: python3 check_task_status.py"
    echo ""
}

# 脚本入口
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Meeting Minutes 强制重建脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  --quick        快速重建（仅重建whisper-server）"
    echo "  --full         完整重建（所有服务）"
    echo ""
    echo "功能:"
    echo "  • 停止所有服务"
    echo "  • 清理Whisper相关镜像和缓存"
    echo "  • 重新构建whisper-server"
    echo "  • 启动服务并验证状态"
    echo ""
    exit 0
fi

if [ "$1" = "--quick" ]; then
    log_info "快速重建模式"
    # 只重建whisper-server
    docker-compose stop whisper-server
    docker rmi meeting-minutes-whisper-server 2>/dev/null || true
    docker-compose build --no-cache whisper-server
    docker-compose up -d whisper-server
    log_success "快速重建完成"
    exit 0
fi

if [ "$1" = "--full" ]; then
    log_info "完整重建模式"
    # 重建所有服务
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    log_success "完整重建完成"
    exit 0
fi

# 默认执行主函数
main
