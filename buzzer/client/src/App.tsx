import { BrowserRouter, Route, Routes } from 'react-router';
import { Landing } from './pages/Landing.js';
import { Placeholder } from './pages/Placeholder.js';

/** The route table, without a router, so tests can mount it in a MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/play/:code" element={<Placeholder title="Player" />} />
      <Route path="/screen/:code" element={<Placeholder title="Screen" />} />
      <Route path="/host/:code" element={<Placeholder title="Host" />} />
      <Route path="/sets" element={<Placeholder title="My question sets" />} />
      <Route path="/sets/:setId" element={<Placeholder title="Edit set" />} />
      <Route path="*" element={<Placeholder title="Page not found" />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
