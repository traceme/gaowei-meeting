module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 类型枚举
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // bug修复
        'docs',     // 文档变更
        'style',    // 代码格式(不影响代码运行的变动)
        'refactor', // 重构(既不是新增功能，也不是修复bug的代码变动)
        'perf',     // 性能优化
        'test',     // 增加测试
        'chore',    // 构建过程或辅助工具的变动
        'ci',       // CI/CD配置文件变更
        'build',    // 构建系统或外部依赖的变更
        'revert',   // 回滚之前的提交
      ],
    ],
    // 主题长度限制
    'subject-max-length': [2, 'always', 100],
    'subject-min-length': [2, 'always', 4],
    // 主题格式
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    // 类型格式
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    // 描述格式
    'header-max-length': [2, 'always', 120],
  },
}; 