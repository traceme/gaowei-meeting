// React 17+ 不需要导入 React
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import ResultPage from './pages/ResultPage';

// 404页面
function NotFoundPage() {
  return (
    <div className='max-w-4xl mx-auto p-6 text-center'>
      <div className='text-6xl mb-4'>🔍</div>
      <h1 className='text-3xl font-bold text-gray-900 mb-4'>页面未找到</h1>
      <p className='text-lg text-gray-600 mb-8'>抱歉，您访问的页面不存在。</p>
      <a 
        href="/" 
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
      >
        返回首页
      </a>
    </div>
  );
}

// 主应用组件
function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path='/' element={<HomePage />} />
          <Route path='/upload' element={<UploadPage />} />
          <Route path='/history' element={<HistoryPage />} />
          <Route path='/result/:taskId' element={<ResultPage />} />
          <Route path='/settings' element={<SettingsPage />} />
          <Route path='*' element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
