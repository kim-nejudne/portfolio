import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { MenuItem, Reservation } from './types';
import { getToken, clearSession } from './lib/session';
import { Navigation } from './components/Navigation';
import { HeroSection } from './components/HeroSection';
import { PublicMenu } from './components/PublicMenu';
import { ReservationFlow } from './components/ReservationFlow';
import { BookingConfirmation } from './components/BookingConfirmation';
import { StoryView } from './components/StoryView';
import { VisitView } from './components/VisitView';
import { StaffDashboard } from './components/StaffDashboard';
import { Footer } from './components/Footer';

export default function App() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState<boolean>(true);
  
  // Reservation state
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [tokenParam, setTokenParam] = useState<string | null>(null);
  const [dishPreference, setDishPreference] = useState<string>('');

  // Staff authentication
  // Restored from sessionStorage so a reload on /staff does not bounce to sign-in.
  const [staffAuthenticated, setStaffAuthenticated] = useState<boolean>(() => getToken() !== null);

  // Fetch active menu from backend Express API
  const fetchMenu = async () => {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        setMenuItems(data);
      }
    } catch (err) {
      console.error('Error fetching menu:', err);
    } finally {
      setLoadingMenu(false);
    }
  };

  useEffect(() => {
    fetchMenu();

    // Check URL parameters for tokenized booking lookup (e.g. ?token=TAL-8F32A1)
    const token = searchParams.get('token');
    if (token) {
      setTokenParam(token);
      navigate('/confirmation');
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
      
      {/* Print Header Navigation */}
      <Navigation staffAuthenticated={staffAuthenticated} />

      {/* Main View Container */}
      <main className="flex-grow">
        
        <Routes>
          <Route path="/" element={
            <div>
              <HeroSection
                dishOfDay={dishOfDay}
                onReserveClick={() => navigate('/reserve')}
                onMenuClick={() => navigate('/menu')}
              />

              {/* Teaser Printed Menu Section */}
              <div className="py-12 border-b border-[#DDD6C8]">
                <div className="max-w-4xl mx-auto px-4 text-center mb-8">
                  <span className="font-mono-data text-[10px] uppercase tracking-[0.25em] text-[#8C6E43]">
                    Selected Cut Teaser
                  </span>
                  <h3 className="font-display text-3xl sm:text-4xl text-[#1A1715] mt-1">
                    CURRENT SERVICE HIGHLIGHTS
                  </h3>
                </div>

                <PublicMenu
                  menuItems={menuItems.slice(0, 6)}
                  onReserveForDish={handleReserveForDish}
                />

                <div className="text-center pt-6">
                  <button
                    onClick={() => navigate('/menu')}
                    className="px-8 py-3 bg-[#1A1715] text-[#F7F4EE] hover:bg-[#7A2322] text-xs uppercase tracking-widest font-sans-ui transition-colors"
                  >
                    View Full Printed Menu →
                  </button>
                </div>
              </div>
            </div>
          } />

          <Route path="/menu" element={
            <PublicMenu
              menuItems={menuItems}
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
        </Routes>

      </main>

      {/* Footer Colophon */}
      <Footer />

    </div>
  );
}
