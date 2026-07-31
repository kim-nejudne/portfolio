import { useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { MenuItem, Reservation } from './types';
import { getToken, clearSession } from './lib/session';
import { Navigation } from './components/Navigation';
import { RouteAnnouncer } from './components/RouteAnnouncer';
import { HeroSection } from './components/HeroSection';
import { PublicMenu } from './components/PublicMenu';
import { ReservationFlow } from './components/ReservationFlow';
import { BookingConfirmation } from './components/BookingConfirmation';
import { StoryView } from './components/StoryView';
import { VisitView } from './components/VisitView';
import { StaffDashboard } from './components/staff/StaffDashboard';
import { NotFoundView } from './components/NotFoundView';
import { Footer } from './components/Footer';

export default function App() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState<boolean>(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  // Reservation state
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [tokenParam, setTokenParam] = useState<string | null>(null);
  const [dishPreference, setDishPreference] = useState<string>('');

  // Staff authentication
  // Restored from sessionStorage so a reload on /staff does not bounce to sign-in.
  const [staffAuthenticated, setStaffAuthenticated] = useState<boolean>(() => getToken() !== null);

  // Fetch active menu from backend Express API
  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch('/api/menu');
      if (!res.ok) throw new Error(`Menu request failed: ${res.status}`);
      setMenuItems(await res.json());
      setMenuError(null);
    } catch (err) {
      console.error('Error fetching menu:', err);
      setMenuError('The menu could not be loaded. Please refresh, or call the hearth on +44 (0)20 7946 0912.');
    } finally {
      setLoadingMenu(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Tokenised booking lookup (e.g. /?token=TAL-8F32A1) hands off to the
  // confirmation route. Kept apart from the menu fetch so that redirect does
  // not re-request the menu on its way through.
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setTokenParam(token);
      navigate('/confirmation', { replace: true });
    }
  }, [searchParams, navigate]);

  const dishOfDay = menuItems.find((i) => i.isDishOfDay) || null;

  const handleReserveForDish = (dishName: string) => {
    setDishPreference(dishName);
    navigate('/reserve');
  };

  const handleBookingComplete = (reservation: Reservation) => {
    setActiveReservation(reservation);
    setTokenParam(reservation.token);
    navigate('/confirmation');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F4EE] text-[#1A1715] paper-stock selection:bg-[#7A2322] selection:text-[#F7F4EE]">

      {/* The header carries four nav links and two actions before the content
          starts; a keyboard user should not have to walk them on every page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#1A1715] focus:text-[#F7F4EE] focus:text-xs focus:font-sans-ui focus:uppercase focus:tracking-widest"
      >
        Skip to main content
      </a>

      <RouteAnnouncer mainRef={mainRef} />

      {/* Print Header Navigation */}
      <Navigation staffAuthenticated={staffAuthenticated} />

      {/* tabIndex -1 makes the landmark a focus target for RouteAnnouncer
          without putting it in the tab order. */}
      <main id="main-content" ref={mainRef} tabIndex={-1} className="flex-grow">

        <Routes>
          <Route path="/" element={
            <div>
              <HeroSection
                dishOfDay={dishOfDay}
                onReserveClick={() => navigate('/reserve')}
                onMenuClick={() => navigate('/menu')}
              />

              {/* Teaser Printed Menu Section */}
              <section aria-labelledby="highlights-heading" className="py-12 border-b border-[#DDD6C8]">
                <div className="max-w-4xl mx-auto px-4 text-center mb-8">
                  <span className="font-mono-data text-[10px] uppercase tracking-[0.25em] text-[#8C6E43]">
                    Selected Cut Teaser
                  </span>
                  <h2 id="highlights-heading" className="font-display text-3xl sm:text-4xl text-[#1A1715] mt-1">
                    CURRENT SERVICE HIGHLIGHTS
                  </h2>
                </div>

                <PublicMenu
                  menuItems={menuItems.slice(0, 6)}
                  loading={loadingMenu}
                  error={menuError}
                  onReserveForDish={handleReserveForDish}
                  variant="teaser"
                />

                <div className="text-center pt-6">
                  <button
                    onClick={() => navigate('/menu')}
                    className="px-8 py-3 bg-[#1A1715] text-[#F7F4EE] hover:bg-[#7A2322] text-xs uppercase tracking-widest font-sans-ui transition-colors"
                  >
                    View Full Printed Menu →
                  </button>
                </div>
              </section>
            </div>
          } />

          <Route path="/menu" element={
            <PublicMenu
              menuItems={menuItems}
              loading={loadingMenu}
              error={menuError}
              onReserveForDish={handleReserveForDish}
            />
          } />

          <Route path="/story" element={<StoryView />} />

          <Route path="/visit" element={<VisitView />} />

          <Route path="/reserve" element={
            <ReservationFlow
              onBookingComplete={handleBookingComplete}
              initialDishPreference={dishPreference}
            />
          } />

          <Route path="/confirmation" element={
            <BookingConfirmation
              reservationToken={tokenParam || undefined}
              reservationData={activeReservation}
              onReturnHome={() => navigate('/')}
            />
          } />

          <Route path="/staff/*" element={
            <StaffDashboard
              authenticated={staffAuthenticated}
              onAuthenticate={() => setStaffAuthenticated(true)}
              onSignOut={() => { clearSession(); setStaffAuthenticated(false); }}
              onMenuUpdated={fetchMenu}
              menuItems={menuItems}
            />
          } />

          <Route path="*" element={<NotFoundView />} />
        </Routes>

      </main>

      {/* Footer Colophon */}
      <Footer />

    </div>
  );
}
