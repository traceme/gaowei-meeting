# UI组件库文档 🧩

## 概述

`@gaowei/ui` 是高维会议AI的共享UI组件库，提供了一套统一的设计系统和可复用组件。所有组件都基于React + TypeScript构建，支持Tailwind CSS样式系统。

## 安装和使用

### 安装

```bash
# 在workspace内部
pnpm add @gaowei/ui

# 在workspace外部
pnpm add @gaowei/shared-types @gaowei/ui
```

### 基础使用

```typescript
import { Button, Card, LoadingSpinner } from '@gaowei/ui';

function MyComponent() {
  return (
    <Card>
      <Button onClick={() => console.log('点击')}>
        点击我
      </Button>
      <LoadingSpinner />
    </Card>
  );
}
```

## 设计系统

### 颜色体系

```css
/* 主色调 */
--primary: #3b82f6;
--primary-hover: #2563eb;
--primary-light: #dbeafe;

/* 中性色 */
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-500: #6b7280;
--gray-900: #111827;

/* 状态色 */
--success: #10b981;
--warning: #f59e0b;
--error: #ef4444;
--info: #3b82f6;
```

### 字体规范

```css
/* 字体大小 */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
```

### 间距规范

```css
/* 间距单位 */
--spacing-1: 0.25rem;  /* 4px */
--spacing-2: 0.5rem;   /* 8px */
--spacing-3: 0.75rem;  /* 12px */
--spacing-4: 1rem;     /* 16px */
--spacing-6: 1.5rem;   /* 24px */
--spacing-8: 2rem;     /* 32px */
```

## 组件API

### Button 按钮

通用的按钮组件，支持多种样式和状态。

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}
```

#### 基础用法

```jsx
import { Button } from '@gaowei/ui';

// 主要按钮
<Button variant="primary">主要操作</Button>

// 次要按钮
<Button variant="secondary">次要操作</Button>

// 轮廓按钮
<Button variant="outline">轮廓按钮</Button>

// 危险操作
<Button variant="danger">删除</Button>

// 加载状态
<Button loading>正在处理...</Button>

// 禁用状态
<Button disabled>已禁用</Button>

// 不同尺寸
<Button size="sm">小按钮</Button>
<Button size="md">中等按钮</Button>
<Button size="lg">大按钮</Button>

// 全宽按钮
<Button fullWidth>全宽按钮</Button>

// 带图标
<Button icon={<PlusIcon />}>添加项目</Button>
```

#### 样式变体

| 变体 | 描述 | 使用场景 |
|------|------|----------|
| `primary` | 主要操作按钮 | 表单提交、确认操作 |
| `secondary` | 次要操作按钮 | 辅助操作、导航 |
| `outline` | 轮廓按钮 | 次要操作、取消按钮 |
| `ghost` | 幽灵按钮 | 最小化界面、链接按钮 |
| `danger` | 危险操作按钮 | 删除、重置等危险操作 |

### Card 卡片

内容容器组件，用于包装和组织相关内容。

```typescript
interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
}
```

#### 基础用法

```jsx
import { Card } from '@gaowei/ui';

// 基础卡片
<Card>
  <h3>卡片标题</h3>
  <p>卡片内容</p>
</Card>

// 自定义内边距
<Card padding="lg">
  <h3>大内边距卡片</h3>
</Card>

// 自定义阴影
<Card shadow="lg">
  <h3>大阴影卡片</h3>
</Card>

// 无边框卡片
<Card border={false}>
  <h3>无边框卡片</h3>
</Card>
```

### LoadingSpinner 加载指示器

显示加载状态的旋转指示器。

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray';
  className?: string;
}
```

#### 基础用法

```jsx
import { LoadingSpinner } from '@gaowei/ui';

// 默认加载器
<LoadingSpinner />

// 不同尺寸
<LoadingSpinner size="sm" />
<LoadingSpinner size="lg" />

// 不同颜色
<LoadingSpinner color="primary" />
<LoadingSpinner color="white" />
```

### ProgressBar 进度条

显示任务进度的条形指示器。

```typescript
interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'error';
  showText?: boolean;
  className?: string;
}
```

#### 基础用法

```jsx
import { ProgressBar } from '@gaowei/ui';

// 基础进度条
<ProgressBar value={60} />

// 显示百分比文本
<ProgressBar value={75} showText />

// 不同颜色
<ProgressBar value={90} color="success" />
<ProgressBar value={30} color="warning" />

// 不同尺寸
<ProgressBar value={50} size="lg" />
```

### FileUpload 文件上传

用于文件选择和拖拽上传的组件。

```typescript
interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // bytes
  onFileSelect: (files: File[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}
```

#### 基础用法

```jsx
import { FileUpload } from '@gaowei/ui';

// 基础文件上传
<FileUpload
  accept="audio/*"
  onFileSelect={(files) => console.log(files)}
  onError={(error) => console.error(error)}
>
  点击或拖拽文件到此处
</FileUpload>

// 音频文件专用
<FileUpload
  accept=".mp3,.wav,.m4a,.aiff"
  maxSize={100 * 1024 * 1024} // 100MB
  onFileSelect={handleAudioUpload}
>
  上传音频文件
</FileUpload>

// 多文件上传
<FileUpload
  multiple
  onFileSelect={(files) => handleMultipleFiles(files)}
>
  选择多个文件
</FileUpload>
```

### CustomAudioPlayer 自定义音频播放器

专业的音频播放器组件，支持时间戳导航和片段跳转。

```typescript
interface CustomAudioPlayerProps {
  audioUrl: string;
  segments?: AudioSegment[];
  onTimeUpdate?: (currentTime: number) => void;
  onSegmentClick?: (segment: AudioSegment) => void;
  className?: string;
}

interface AudioSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  confidence?: number;
}
```

#### 基础用法

```jsx
import { CustomAudioPlayer } from '@gaowei/ui';

// 基础音频播放器
<CustomAudioPlayer
  audioUrl="/uploads/meeting.mp3"
  onTimeUpdate={(time) => console.log('当前时间:', time)}
/>

// 带转录片段的播放器
<CustomAudioPlayer
  audioUrl="/uploads/meeting.mp3"
  segments={[
    { id: '1', start: 0, end: 5.2, text: '会议开始' },
    { id: '2', start: 5.2, end: 12.8, text: '讨论第一项议题' }
  ]}
  onSegmentClick={(segment) => console.log('点击片段:', segment)}
/>
```

#### 功能特性

- ✅ **标准播放控制**: 播放/暂停、进度条、音量控制
- ✅ **时间戳显示**: 当前时间和总时长显示
- ✅ **片段导航**: 点击转录片段跳转到对应时间
- ✅ **快捷键支持**: 空格键播放/暂停
- ✅ **响应式设计**: 适配不同屏幕尺寸

### Toast 消息提示

用于显示临时消息的提示组件。

```typescript
interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number; // ms, 0表示不自动消失
  onClose?: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}
```

#### 基础用法

```jsx
import { Toast, useToast } from '@gaowei/ui';

// 使用Toast Hook
function MyComponent() {
  const { showToast } = useToast();
  
  const handleSuccess = () => {
    showToast({
      type: 'success',
      message: '操作成功完成！'
    });
  };
  
  const handleError = () => {
    showToast({
      type: 'error',
      message: '操作失败，请重试',
      duration: 5000
    });
  };
  
  return (
    <div>
      <Button onClick={handleSuccess}>成功提示</Button>
      <Button onClick={handleError}>错误提示</Button>
    </div>
  );
}

// 直接使用Toast组件
<Toast
  type="warning"
  message="请注意：文件大小超过建议限制"
  duration={3000}
  onClose={() => setShowToast(false)}
/>
```

### Modal 模态框

用于显示覆盖内容的模态对话框。

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  className?: string;
}
```

#### 基础用法

```jsx
import { Modal, Button } from '@gaowei/ui';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        打开模态框
      </Button>
      
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="确认操作"
        size="md"
      >
        <p>您确定要执行此操作吗？</p>
        <div className="flex gap-2 mt-4">
          <Button variant="primary">确认</Button>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            取消
          </Button>
        </div>
      </Modal>
    </>
  );
}
```

## 高级用法

### 自定义主题

组件库支持通过CSS变量自定义主题：

```css
:root {
  /* 自定义主色调 */
  --primary: #8b5cf6;
  --primary-hover: #7c3aed;
  
  /* 自定义圆角 */
  --border-radius-md: 0.5rem;
  
  /* 自定义字体 */
  --font-family: 'Inter', sans-serif;
}
```

### 响应式设计

所有组件都支持响应式设计：

```jsx
// 响应式尺寸
<Button className="text-sm md:text-base lg:text-lg">
  响应式按钮
</Button>

// 响应式布局
<Card className="p-4 md:p-6 lg:p-8">
  响应式内边距
</Card>
```

### 组合使用

```jsx
import { Card, Button, LoadingSpinner, ProgressBar } from '@gaowei/ui';

function TranscriptionCard({ task }) {
  const isProcessing = task.status === 'processing';
  
  return (
    <Card padding="lg" shadow="md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{task.title}</h3>
        {isProcessing && <LoadingSpinner size="sm" />}
      </div>
      
      {isProcessing && (
        <ProgressBar
          value={task.progress}
          color="primary"
          showText
          className="mb-4"
        />
      )}
      
      <div className="flex gap-2">
        <Button variant="primary" disabled={isProcessing}>
          查看结果
        </Button>
        <Button variant="outline">
          重新处理
        </Button>
      </div>
    </Card>
  );
}
```

## 最佳实践

### 1. 一致性原则

- 在同一应用中保持组件使用的一致性
- 遵循设计系统的颜色和字体规范
- 使用统一的间距和尺寸规范

### 2. 可访问性

```jsx
// 正确：提供适当的ARIA标签
<Button aria-label="关闭对话框" icon={<CloseIcon />} />

// 正确：使用语义化的HTML结构
<Card role="article" aria-labelledby="card-title">
  <h3 id="card-title">卡片标题</h3>
</Card>
```

### 3. 性能优化

```jsx
// 推荐：按需导入组件
import { Button } from '@gaowei/ui';

// 避免：全量导入
import * as UI from '@gaowei/ui';
```

### 4. 错误处理

```jsx
// 正确：处理组件错误状态
<FileUpload
  onFileSelect={handleFileSelect}
  onError={(error) => {
    console.error('文件上传错误:', error);
    showToast({ type: 'error', message: error });
  }}
/>
```

## 开发指南

### 添加新组件

1. **创建组件文件**：
   ```bash
   cd packages/ui/src/components
   mkdir NewComponent
   touch NewComponent/index.tsx
   touch NewComponent/NewComponent.stories.tsx
   ```

2. **实现组件**：
   ```typescript
   // NewComponent/index.tsx
   import React from 'react';
   
   interface NewComponentProps {
     // 定义Props接口
   }
   
   export const NewComponent: React.FC<NewComponentProps> = (props) => {
     return <div>新组件</div>;
   };
   ```

3. **导出组件**：
   ```typescript
   // src/index.ts
   export { NewComponent } from './components/NewComponent';
   ```

### 组件测试

```typescript
// NewComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { NewComponent } from './NewComponent';

describe('NewComponent', () => {
  it('渲染正确', () => {
    render(<NewComponent />);
    expect(screen.getByText('新组件')).toBeInTheDocument();
  });
});
```

### 构建和发布

```bash
# 构建组件库
cd packages/ui
pnpm build

# 类型检查
pnpm type-check

# 运行测试
pnpm test
```

## 故障排除

### 常见问题

1. **样式不生效**：
   - 确保Tailwind CSS已正确配置
   - 检查CSS变量是否正确定义

2. **类型错误**：
   - 确保已安装`@gaowei/shared-types`
   - 检查TypeScript版本兼容性

3. **组件不显示**：
   - 检查导入路径是否正确
   - 确认组件已正确导出

### 调试技巧

```jsx
// 使用调试Props
<Button 
  {...props}
  style={{ border: '1px solid red' }} // 临时边框
  onClick={() => console.log('Button clicked')} // 调试点击
/>
```

## 版本历史

- **v2.0.0**: Monorepo重构，TypeScript重写
- **v1.2.0**: 添加CustomAudioPlayer组件
- **v1.1.0**: 添加Toast和Modal组件
- **v1.0.0**: 初始版本，基础组件集合

---

**组件库版本**: v2.0.0  
**最后更新**: 2025-06-22  
**维护团队**: 前端开发组 