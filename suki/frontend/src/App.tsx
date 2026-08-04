import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { TillPage } from './routes/TillPage';
import { CartPage } from './routes/CartPage';
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
import { SaleProvider } from './lib/sale';

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
            // The sale spans two routes now, so it lives above both of them —
            // and inside the gate, so a locked device never reads a draft off
            // disk. It is not on the tab bar: the cart is somewhere you are
            // sent mid-sale and leave when the sale is done, not a place in
            // the shop.
            <Gate>
              <SaleProvider>
                <AppShell />
              </SaleProvider>
            </Gate>
          }
        >
          <Route path="/" element={<TillPage />} />
          <Route path="/cart" element={<CartPage />} />
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
