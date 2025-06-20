import { Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'
import './App.css'

// 懒加载页面组件
const HomePage = lazy(() => import('./pages/HomePage'))
const UploadPage = lazy(() => import('./pages/UploadPageSimplified'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route
          index
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <HomePage />
            </Suspense>
          }
        />
        <Route
          path="upload"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <UploadPage />
            </Suspense>
          }
        />
        <Route
          path="history"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <HistoryPage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <SettingsPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
