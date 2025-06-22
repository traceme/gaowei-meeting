#!/bin/bash

# 项目回滚脚本
# 用法: ./scripts/rollback.sh [backup-path] [rollback-type]

set -e

# 配置
BACKUP_PATH=${1:-""}
ROLLBACK_TYPE=${2:-"full"}
PROJECT_ROOT=$(pwd)

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 显示可用备份
list_available_backups() {
    log "Available backups:"
    
    if [ ! -d "backups" ]; then
        warning "No backups directory found"
        return
    fi
    
    # 列出所有备份
    echo "Backup files:"
    find backups -name "*.tar.gz" -o -type d -name "*-*" | sort -r | head -10
    echo ""
}

# 验证备份文件
verify_backup_file() {
    local backup_path="$1"
    
    if [ ! -e "$backup_path" ]; then
        error "Backup path not found: $backup_path"
    fi
    
    if [ -f "$backup_path" ] && [[ "$backup_path" != *.tar.gz ]]; then
        error "Backup file must be a .tar.gz archive"
    fi
    
    if [ -d "$backup_path" ]; then
        if [ ! -f "$backup_path/backup-manifest.txt" ]; then
            error "Invalid backup directory: missing manifest file"
        fi
    fi
    
    success "Backup file verified: $backup_path"
}

# 提取备份（如果是压缩文件）
extract_backup() {
    local backup_path="$1"
    local temp_dir="temp-restore-$(date +%Y%m%d_%H%M%S)"
    
    if [ -f "$backup_path" ]; then
        log "Extracting backup archive..."
        mkdir -p "$temp_dir"
        tar -xzf "$backup_path" -C "$temp_dir"
        
        # 找到解压后的目录
        local extracted_dir=$(find "$temp_dir" -mindepth 1 -maxdepth 1 -type d | head -1)
        if [ -z "$extracted_dir" ]; then
            error "Failed to find extracted backup directory"
        fi
        
        echo "$extracted_dir"
    else
        echo "$backup_path"
    fi
}

# 创建当前状态备份
create_pre_rollback_backup() {
    log "Creating pre-rollback backup..."
    
    ./scripts/backup.sh quick "Before rollback $(date)"
    
    success "Pre-rollback backup created"
}

# 回滚源代码
rollback_source_code() {
    local backup_dir="$1"
    
    log "Rolling back source code..."
    
    # 备份当前状态
    create_pre_rollback_backup
    
    # 停止运行中的服务
    log "Stopping running services..."
    pnpm docker:stop 2>/dev/null || true
    
    # 回滚 packages 目录
    if [ -d "$backup_dir/packages" ]; then
        log "Rolling back packages directory..."
        rm -rf packages
        cp -r "$backup_dir/packages" .
        success "Packages directory restored"
    fi
    
    # 回滚配置文件
    log "Rolling back configuration files..."
    cp "$backup_dir/package.json" . 2>/dev/null || true
    cp "$backup_dir/pnpm-lock.yaml" . 2>/dev/null || true
    cp "$backup_dir/pnpm-workspace.yaml" . 2>/dev/null || true
    cp "$backup_dir/turbo.json" . 2>/dev/null || true
    cp "$backup_dir/tsconfig.json" . 2>/dev/null || true
    cp "$backup_dir/.eslintrc.json" . 2>/dev/null || true
    cp "$backup_dir/.prettierrc.js" . 2>/dev/null || true
    cp "$backup_dir/vitest.config.ts" . 2>/dev/null || true
    
    # 回滚 Docker 配置
    cp "$backup_dir"/Dockerfile* . 2>/dev/null || true
    cp "$backup_dir"/docker-compose*.yml . 2>/dev/null || true
    
    # 回滚脚本目录
    if [ -d "$backup_dir/scripts" ]; then
        rm -rf scripts
        cp -r "$backup_dir/scripts" .
        chmod +x scripts/*.sh
    fi
    
    # 回滚文档
    cp "$backup_dir/README.md" . 2>/dev/null || true
    if [ -d "$backup_dir/docs" ]; then
        rm -rf docs
        cp -r "$backup_dir/docs" . 2>/dev/null || true
    fi
    
    success "Source code rollback completed"
}

# 回滚数据
rollback_data() {
    local backup_dir="$1"
    
    log "Rolling back data files..."
    
    # 回滚数据库
    if [ -f "$backup_dir/data/meetings.db" ]; then
        mkdir -p data
        cp "$backup_dir/data/meetings.db" data/
        log "Database restored"
    fi
    
    # 回滚上传文件
    if [ -d "$backup_dir/uploads" ]; then
        rm -rf uploads
        cp -r "$backup_dir/uploads" .
        log "Upload files restored"
    fi
    
    success "Data rollback completed"
}

# 回滚 TaskMaster
rollback_taskmaster() {
    local backup_dir="$1"
    
    if [ -d "$backup_dir/.taskmaster" ]; then
        log "Rolling back TaskMaster data..."
        rm -rf .taskmaster
        cp -r "$backup_dir/.taskmaster" .
        success "TaskMaster data restored"
    fi
}

# 恢复依赖
restore_dependencies() {
    log "Restoring dependencies..."
    
    # 清理现有依赖
    rm -rf node_modules packages/*/node_modules
    
    # 重新安装
    pnpm install
    
    success "Dependencies restored"
}

# 验证回滚结果
verify_rollback() {
    log "Verifying rollback..."
    
    # 检查关键文件
    local required_files=(
        "package.json"
        "pnpm-lock.yaml"
        "packages"
    )
    
    for item in "${required_files[@]}"; do
        if [ ! -e "$item" ]; then
            error "Required item missing after rollback: $item"
        fi
    done
    
    # 尝试构建
    log "Testing build..."
    pnpm build
    
    if [ $? -eq 0 ]; then
        success "Build test passed"
    else
        warning "Build test failed - manual intervention may be needed"
    fi
    
    success "Rollback verification completed"
}

# 清理临时文件
cleanup() {
    log "Cleaning up temporary files..."
    
    # 清理临时解压目录
    rm -rf temp-restore-* 2>/dev/null || true
    
    success "Cleanup completed"
}

# 显示回滚后的状态
show_rollback_status() {
    local backup_dir="$1"
    
    log "Rollback completed! Status:"
    echo ""
    
    # 显示备份信息
    if [ -f "$backup_dir/backup-manifest.txt" ]; then
        echo "=== Restored from backup ==="
        head -10 "$backup_dir/backup-manifest.txt"
        echo ""
    fi
    
    # 显示当前 Git 状态
    echo "=== Current Git Status ==="
    git status --short 2>/dev/null || echo "Not a git repository"
    echo ""
    
    # 显示服务状态
    echo "=== Next Steps ==="
    echo "1. Review the changes: git status"
    echo "2. Start services: pnpm dev:full"
    echo "3. Test functionality: pnpm health"
    echo "4. If satisfied, commit changes: git add . && git commit -m 'Rollback to backup'"
    echo ""
}

# 主回滚流程
main() {
    if [ -z "$BACKUP_PATH" ]; then
        list_available_backups
        echo ""
        error "Please specify a backup path. Usage: $0 <backup-path> [rollback-type]"
    fi
    
    log "Starting rollback from: $BACKUP_PATH"
    log "Rollback type: $ROLLBACK_TYPE"
    
    # 确认操作
    echo ""
    echo -e "${YELLOW}WARNING: This will replace current files with backup data.${NC}"
    echo -e "${YELLOW}A pre-rollback backup will be created automatically.${NC}"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Rollback cancelled by user"
        exit 0
    fi
    
    # 验证备份
    verify_backup_file "$BACKUP_PATH"
    
    # 解压备份（如果需要）
    local backup_dir=$(extract_backup "$BACKUP_PATH")
    
    # 执行回滚
    case "$ROLLBACK_TYPE" in
        "code")
            rollback_source_code "$backup_dir"
            restore_dependencies
            ;;
        "data")
            rollback_data "$backup_dir"
            ;;
        "taskmaster")
            rollback_taskmaster "$backup_dir"
            ;;
        "full"|*)
            rollback_source_code "$backup_dir"
            rollback_data "$backup_dir"
            rollback_taskmaster "$backup_dir"
            restore_dependencies
            ;;
    esac
    
    # 验证回滚
    verify_rollback
    
    # 清理
    cleanup
    
    # 显示状态
    show_rollback_status "$backup_dir"
    
    success "Rollback completed successfully!"
}

# 显示使用说明
usage() {
    echo "Usage: $0 <backup-path> [rollback-type]"
    echo ""
    echo "Arguments:"
    echo "  backup-path     Path to backup file (.tar.gz) or directory"
    echo "  rollback-type   Type of rollback (full|code|data|taskmaster) [default: full]"
    echo ""
    echo "Rollback types:"
    echo "  full        Complete rollback (source code + data + dependencies)"
    echo "  code        Source code and configuration only"
    echo "  data        Data files only (database, uploads)"
    echo "  taskmaster  TaskMaster data only"
    echo ""
    echo "Examples:"
    echo "  $0 backups/full-20241222_120000.tar.gz"
    echo "  $0 backups/full-20241222_120000 code"
    echo "  $0 --list                                    # List available backups"
    echo ""
}

# 处理命令行参数
case "${1:-}" in
    -h|--help)
        usage
        exit 0
        ;;
    -l|--list)
        list_available_backups
        exit 0
        ;;
    "")
        usage
        exit 1
        ;;
    *)
        main
        ;;
esac 