import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AcademyPage } from './pages/AcademyPage';
import { BudgetPage } from './pages/BudgetPage';
import { ComparePage } from './pages/ComparePage';
import { FavoritesPage } from './pages/FavoritesPage';
import { HomePage } from './pages/HomePage';
import { MarketPage } from './pages/MarketPage';
import { NeisPage } from './pages/NeisPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { AppProvider } from './store/AppContext';

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="academy/:id" element={<AcademyPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="market" element={<MarketPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="neis" element={<NeisPage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}

// 정적 호스팅에서도 새로고침이 깨지지 않도록 해시 라우터를 쓴다.
// 단일 파일 데모(임베드 환경)는 주소창을 건드리지 않도록 메모리 라우터를 쓴다.
const Router = typeof __SINGLE_FILE__ !== 'undefined' && __SINGLE_FILE__ ? MemoryRouter : HashRouter;

export default function App() {
  return (
    <AppProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AppProvider>
  );
}
