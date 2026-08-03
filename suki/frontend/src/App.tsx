import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { TillPage } from './routes/TillPage';
import { ListaPage } from './routes/ListaPage';
import { CustomerPage } from './routes/CustomerPage';
import { StockPage } from './routes/StockPage';
import { ItemPage } from './routes/ItemPage';
import { RestockPage } from './routes/RestockPage';
import { DayPage } from './routes/DayPage';
import { UnlockPage } from './routes/UnlockPage';
import { SettingsPage } from './routes/SettingsPage';
import { NotFoundPage } from './routes/NotFoundPage';
import { UnlockProvider, useUnlock } from './lib/unlock';

function Gate({ children }: { children: React.ReactNode }) {
  const { unlocked } = useUnlock();
  if (!unlocked) return <Navigate to="/unlock" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <UnlockProvider>
      <Routes>
        <Route path="/unlock" element={<UnlockPage />} />
        <Route
          element={
            <Gate>
              <AppShell />
            </Gate>
          }
        >
          <Route path="/" element={<TillPage />} />
          <Route path="/lista" element={<ListaPage />} />
          <Route path="/lista/:customerId" element={<CustomerPage />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/stock/:itemId" element={<ItemPage />} />
          <Route path="/restock" element={<RestockPage />} />
          <Route path="/day" element={<DayPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </UnlockProvider>
  );
}
