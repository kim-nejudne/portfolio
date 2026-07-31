import React, { useState, useEffect } from 'react';
import { MenuItem, Reservation } from './types';
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
  const [activeTab, setActiveTab] = useState<'home' | 'menu' | 'story' | 'visit' | 'reserve' | 'staff' | 'confirmation'>('home');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState<boolean>(true);
  
  // Reservation state
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [tokenParam, setTokenParam] = useState<string | null>(null);
  const [dishPreference, setDishPreference] = useState<string>('');

  // Staff authentication
  const [staffAuthenticated, setStaffAuthenticated] = useState<boolean>(false);

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
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setTokenParam(token);
      setActiveTab('confirmation');
    }
  }, []);

  const dishOfDay = menuItems.find((i) => i.isDishOfDay) || null;

  const handleReserveForDish = (dishName: string) => {
    setDishPreference(dishName);
    setActiveTab('reserve');
  };

  const handleBookingComplete = (reservation: Reservation) => {
    setActiveReservation(reservation);
    setTokenParam(reservation.token);
    setActiveTab('confirmation');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F4EE] text-[#1A1715] paper-stock selection:bg-[#7A2322] selection:text-[#F7F4EE]">
      
      {/* Print Header Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        staffAuthenticated={staffAuthenticated}
      />

      {/* Main View Container */}
      <main className="flex-grow">
        
        {/* VIEW 1: HOME */}
        {activeTab === 'home' && (
          <div>
            <HeroSection
              dishOfDay={dishOfDay}
              onReserveClick={() => setActiveTab('reserve')}
              onMenuClick={() => setActiveTab('menu')}
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
                  onClick={() => setActiveTab('menu')}
                  className="px-8 py-3 bg-[#1A1715] text-[#F7F4EE] hover:bg-[#7A2322] text-xs uppercase tracking-widest font-sans-ui transition-colors"
                >
                  View Full Printed Menu →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: THE MENU */}
        {activeTab === 'menu' && (
          <PublicMenu
            menuItems={menuItems}
            onReserveForDish={handleReserveForDish}
          />
        )}

        {/* VIEW 3: THE CRAFT (STORY) */}
        {activeTab === 'story' && <StoryView />}

        {/* VIEW 4: VISIT & LOCATION */}
        {activeTab === 'visit' && <VisitView />}

        {/* VIEW 5: RESERVATION FLOW (4 Steps on One Page) */}
        {activeTab === 'reserve' && (
          <ReservationFlow
            onBookingComplete={handleBookingComplete}
            initialDishPreference={dishPreference}
          />
        )}

        {/* VIEW 6: BOOKING CONFIRMATION (Tokenized Link) */}
        {activeTab === 'confirmation' && (
          <BookingConfirmation
            reservationToken={tokenParam || undefined}
            reservationData={activeReservation}
            onReturnHome={() => setActiveTab('home')}
          />
        )}

        {/* VIEW 7: STAFF SERVICE CONTROL DASHBOARD */}
        {activeTab === 'staff' && (
          <StaffDashboard
            authenticated={staffAuthenticated}
            onAuthenticate={(token) => setStaffAuthenticated(true)}
            onMenuUpdated={fetchMenu}
            menuItems={menuItems}
          />
        )}

      </main>

      {/* Footer Colophon */}
      <Footer onNavigate={setActiveTab} />

    </div>
  );
}
