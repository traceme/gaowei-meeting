import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../utils/cn';

export interface LayoutProps {
  children?: React.ReactNode;
  title?: string;
  showStatus?: boolean;
  statusText?: string;
  statusColor?: 'green' | 'yellow' | 'red' | 'gray';
  navItems?: Array<{
    path: string;
    label: string;
    icon: string;
  }>;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  title = '高维会议AI',
  showStatus = true,
  statusText = '已连接',
  statusColor = 'green',
  navItems = [
    { path: '/', label: '首页', icon: '🏠' },
    { path: '/upload', label: '上传音频', icon: '📤' },
    { path: '/history', label: '历史记录', icon: '📊' },
    { path: '/settings', label: '设置', icon: '⚙️' },
  ],
}) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const statusColors = {
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
    gray: 'text-gray-600',
  };

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* 顶部导航栏 */}
      <header className='bg-white shadow-sm border-b border-gray-200'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center h-16'>
            {/* Logo */}
            <div className='flex items-center'>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className='md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors'
              >
                <span className='sr-only'>打开菜单</span>☰
              </button>
              <Link to='/' className='flex items-center space-x-2 ml-2 md:ml-0'>
                <span className='text-2xl'>🤖</span>
                <span className='text-xl font-bold text-gray-900'>{title}</span>
              </Link>
            </div>

            {/* 桌面端导航 */}
            <nav className='hidden md:flex space-x-8'>
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    location.pathname === item.path
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  )}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* 用户操作区 */}
            <div className='flex items-center space-x-4'>
              {showStatus && (
                <div className='text-sm text-gray-500'>
                  状态:{' '}
                  <span className={statusColors[statusColor]}>
                    {statusText}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 移动端侧边栏 */}
      {isSidebarOpen && (
        <div className='fixed inset-0 z-50 md:hidden'>
          <div
            className='fixed inset-0 bg-black bg-opacity-25'
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className='fixed left-0 top-0 h-full w-64 bg-white shadow-lg'>
            <div className='flex items-center justify-between p-4 border-b'>
              <span className='text-lg font-semibold'>菜单</span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className='p-2 rounded-md text-gray-400 hover:text-gray-500 transition-colors'
              >
                ✕
              </button>
            </div>
            <nav className='p-4'>
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-3 rounded-md text-base font-medium transition-colors',
                    location.pathname === item.path
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  )}
                >
                  <span className='text-xl'>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* 主要内容区 */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {children}
      </main>
    </div>
  );
};
