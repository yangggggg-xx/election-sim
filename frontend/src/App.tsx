import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import StaticYearPage from './pages/StaticYearPage';
import StaticYearPage2024 from './pages/StaticYearPage2024';
import InteractivePage2026 from './pages/InteractivePage2026';
import './index.css';

export default function App() {
  return (
    <ConfigProvider theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#60a5fa',
        colorBgContainer: '#0b1735',
        colorBgElevated: '#0f1f45',
        colorBgLayout: '#070d1f',
        colorBorder: 'rgba(80,130,220,0.15)',
        borderRadius: 8,
      },
    }}>
      <Routes>
        <Route path="/2020" element={<StaticYearPage />} />
        <Route path="/2024" element={<StaticYearPage2024 />} />
        <Route path="/2026" element={<InteractivePage2026 />} />
        <Route path="*" element={<Navigate to="/2020" replace />} />
      </Routes>
    </ConfigProvider>
  );
}
