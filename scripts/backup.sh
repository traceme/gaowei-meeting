#!/bin/bash

# 项目完整备份脚本
# 用法: ./scripts/backup.sh [backup-type] [description]

set -e

# 配置
BACKUP_TYPE=${1:-full}
DESCRIPTION=${2:-"Auto backup"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/${BACKUP_TYPE}-${TIMESTAMP}"
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

# 创建备份目录
create_backup_dir() {
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    success "Backup directory created"
}

# 备份源代码
backup_source_code() {
    log "Backing up source code..."
    
    # 创建代码备份，排除不必要的文件
    tar -czf "$BACKUP_DIR/source-code.tar.gz" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='dist' \
        --exclude='build' \
        --exclude='.turbo' \
        --exclude='uploads' \
        --exclude='data' \
        --exclude='logs' \
        --exclude='*.log' \
        --exclude='backups' \
        .
    
    success "Source code backed up to $BACKUP_DIR/source-code.tar.gz"
}

# 备份完整项目（包含依赖）
backup_full_project() {
    log "Backing up full project with dependencies..."
    
    # 备份 package.json 和 lock 文件
    cp package.json "$BACKUP_DIR/"
    cp pnpm-lock.yaml "$BACKUP_DIR/"
    cp pnpm-workspace.yaml "$BACKUP_DIR/"
    
    # 备份关键配置文件
    cp -r .github "$BACKUP_DIR/" 2>/dev/null || true
    cp .gitignore "$BACKUP_DIR/" 2>/dev/null || true
    cp .eslintrc.json "$BACKUP_DIR/" 2>/dev/null || true
    cp .prettierrc.js "$BACKUP_DIR/" 2>/dev/null || true
    cp turbo.json "$BACKUP_DIR/" 2>/dev/null || true
    cp vitest.config.ts "$BACKUP_DIR/" 2>/dev/null || true
    cp tsconfig.json "$BACKUP_DIR/" 2>/dev/null || true
    cp Dockerfile* "$BACKUP_DIR/" 2>/dev/null || true
    cp docker-compose*.yml "$BACKUP_DIR/" 2>/dev/null || true
    cp env.example "$BACKUP_DIR/" 2>/dev/null || true
    
    # 备份 packages 目录
    cp -r packages "$BACKUP_DIR/"
    
    # 备份 scripts 目录
    cp -r scripts "$BACKUP_DIR/"
    
    # 备份文档
    cp README.md "$BACKUP_DIR/" 2>/dev/null || true
    cp -r docs "$BACKUP_DIR/" 2>/dev/null || true
    
    success "Full project backed up"
}

# 备份数据库和数据文件
backup_data() {
    log "Backing up data files..."
    
    # 创建数据备份目录
    mkdir -p "$BACKUP_DIR/data"
    
    # 备份数据库文件
    if [ -f "data/meetings.db" ]; then
        cp "data/meetings.db" "$BACKUP_DIR/data/"
        log "Database backed up"
    fi
    
    # 备份上传文件（如果存在且不太大）
    if [ -d "uploads" ]; then
        upload_size=$(du -sm uploads | cut -f1)
        if [ "$upload_size" -lt 100 ]; then  # 小于100MB才备份
            cp -r uploads "$BACKUP_DIR/"
            log "Upload files backed up"
        else
            warning "Upload directory too large (${upload_size}MB), skipping"
        fi
    fi
    
    success "Data files backed up"
}

# 备份Git信息
backup_git_info() {
    log "Backing up Git information..."
    
    # 当前分支和提交信息
    echo "Current branch: $(git branch --show-current)" > "$BACKUP_DIR/git-info.txt"
    echo "Current commit: $(git rev-parse HEAD)" >> "$BACKUP_DIR/git-info.txt"
    echo "Commit message: $(git log -1 --pretty=%B)" >> "$BACKUP_DIR/git-info.txt"
    echo "Modified files:" >> "$BACKUP_DIR/git-info.txt"
    git status --porcelain >> "$BACKUP_DIR/git-info.txt"
    
    # 备份Git配置
    cp .git/config "$BACKUP_DIR/git-config" 2>/dev/null || true
    
    # 分支列表
    git branch -a > "$BACKUP_DIR/git-branches.txt"
    
    # 最近的提交历史
    git log --oneline -20 > "$BACKUP_DIR/git-recent-commits.txt"
    
    success "Git information backed up"
}

# 备份依赖信息
backup_dependencies() {
    log "Backing up dependency information..."
    
    # 当前安装的依赖
    pnpm list --depth=0 > "$BACKUP_DIR/dependencies.txt" 2>/dev/null || true
    
    # pnpm 版本信息
    pnpm --version > "$BACKUP_DIR/pnpm-version.txt"
    node --version > "$BACKUP_DIR/node-version.txt"
    
    # 系统信息
    uname -a > "$BACKUP_DIR/system-info.txt"
    
    success "Dependency information backed up"
}

# 备份任务管理信息
backup_taskmaster() {
    log "Backing up TaskMaster information..."
    
    if [ -d ".taskmaster" ]; then
        cp -r .taskmaster "$BACKUP_DIR/"
        success "TaskMaster data backed up"
    else
        warning "TaskMaster directory not found"
    fi
}

# 创建备份清单
create_backup_manifest() {
    log "Creating backup manifest..."
    
    cat > "$BACKUP_DIR/backup-manifest.txt" << EOF
=== Project Backup Manifest ===
Backup Type: $BACKUP_TYPE
Description: $DESCRIPTION
Created: $(date)
Git Commit: $(git rev-parse HEAD 2>/dev/null || echo "Not a git repository")
Git Branch: $(git branch --show-current 2>/dev/null || echo "No branch")

=== Backup Contents ===
EOF
    
    # 列出备份内容
    find "$BACKUP_DIR" -type f | sort >> "$BACKUP_DIR/backup-manifest.txt"
    
    success "Backup manifest created"
}

# 验证备份完整性
verify_backup() {
    log "Verifying backup integrity..."
    
    # 检查关键文件是否存在
    local required_files=(
        "package.json"
        "pnpm-lock.yaml"
        "backup-manifest.txt"
        "git-info.txt"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$BACKUP_DIR/$file" ]; then
            error "Required file missing in backup: $file"
        fi
    done
    
    # 检查 packages 目录
    if [ ! -d "$BACKUP_DIR/packages" ]; then
        error "Packages directory missing in backup"
    fi
    
    # 计算备份大小
    local backup_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    log "Backup size: $backup_size"
    
    success "Backup integrity verified"
}

# 压缩备份（可选）
compress_backup() {
    if [ "$BACKUP_TYPE" = "full" ]; then
        log "Compressing backup..."
        
        tar -czf "${BACKUP_DIR}.tar.gz" -C backups "$(basename "$BACKUP_DIR")"
        
        if [ $? -eq 0 ]; then
            rm -rf "$BACKUP_DIR"
            success "Backup compressed to ${BACKUP_DIR}.tar.gz"
        else
            warning "Compression failed, keeping uncompressed backup"
        fi
    fi
}

# 主备份流程
main() {
    log "Starting $BACKUP_TYPE backup: $DESCRIPTION"
    
    create_backup_dir
    
    case "$BACKUP_TYPE" in
        "quick")
            backup_source_code
            backup_git_info
            ;;
        "data")
            backup_data
            backup_git_info
            ;;
        "full"|*)
            backup_source_code
            backup_full_project
            backup_data
            backup_git_info
            backup_dependencies
            backup_taskmaster
            ;;
    esac
    
    create_backup_manifest
    verify_backup
    
    if [ "$BACKUP_TYPE" = "full" ]; then
        compress_backup
    fi
    
    success "Backup completed successfully!"
    log "Backup location: $BACKUP_DIR"
    
    # 显示备份信息
    if [ -f "${BACKUP_DIR}.tar.gz" ]; then
        log "Compressed backup: ${BACKUP_DIR}.tar.gz"
        log "Size: $(du -sh "${BACKUP_DIR}.tar.gz" | cut -f1)"
    else
        log "Backup directory: $BACKUP_DIR"
        log "Size: $(du -sh "$BACKUP_DIR" | cut -f1)"
    fi
}

# 显示使用说明
usage() {
    echo "Usage: $0 [backup-type] [description]"
    echo ""
    echo "Backup types:"
    echo "  quick       Source code and git info only"
    echo "  data        Data files and git info only"
    echo "  full        Complete project backup (default)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Full backup with auto description"
    echo "  $0 full \"Before cleanup\"            # Full backup with custom description"
    echo "  $0 quick \"Before refactoring\"       # Quick backup"
    echo "  $0 data \"Database backup\"           # Data only backup"
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