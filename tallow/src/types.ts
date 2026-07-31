export type MenuCategory = 'cuts' | 'starters' | 'sides' | 'sauces' | 'desserts' | 'drinks';

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  cutName?: string;       // e.g. "bavette", "ribeye", "picanha"
  weightGrams?: number;  // e.g. 350, 800
  agingDays?: number;    // e.g. 45, 60
  price: number;         // e.g. 42
  description: string;   // Terse, confident prose
  photoUrl?: string;     // Gutter photograph
  is86: boolean;
  isDishOfDay: boolean;
  sortOrder: number;
}

export type ReservationStatus = 'confirmed' | 'seated' | 'completed' | 'cancelled';

export interface Reservation {
  id: string;
  token: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:mm (e.g. "19:00")
  partySize: number;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  status: ReservationStatus;
  createdAt: string;
}

export interface TimeSlotAvailability {
  time: string;
  totalCoversBooked: number;
  maxCovers: number;
  availableCovers: number;
  isAvailable: boolean;
  reason?: string;
}

export interface CoverSummary {
  date: string;
  totalReservations: number;
  totalCovers: number;
  maxDailyCapacity: number;
  sittingCounts: {
    early: number; // 17:00 - 18:30
    prime: number; // 18:30 - 20:30
    late: number;  // 20:30 - 22:30
  };
}
