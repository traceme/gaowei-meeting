import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout, Button } from '@gaowei/ui';
import { HomePage } from './pages/HomePage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { useApiStatus } from './hooks/useApiStatus';

// 404页面
function NotFoundPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 text-center">
      <div className="text-6xl mb-4">🔍</div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">页面未找到</h1>
      <p className="text-lg text-gray-600 mb-8">
        抱歉，您访问的页面不存在。
      </p>
      <Button onClick={() => window.location.href = '/'}>
        返回首页
      </Button>
    </div>
  );
}

// 主应用组件
function App() {
  const { isOnline } = useApiStatus();

  const navItems = [
    { path: '/', label: '首页', icon: '🏠' },
    { path: '/history', label: '会议历史', icon: '📊' },
    { path: '/settings', label: '设置', icon: '⚙️' },
  ];

  return (
    <Router>
      <Layout
        title="高维会议AI"
        showStatus={true}
        statusText={isOnline ? 'API已连接' : 'API断开'}
        statusColor={isOnline ? 'green' : 'red'}
        navItems={navItems}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App; 