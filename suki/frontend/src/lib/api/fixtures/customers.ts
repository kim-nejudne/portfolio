// Deterministic fixture data. Fixed ISO strings, no new Date(), no Math.random().
// The rest of the app reaches these ONLY through src/lib/api/*.ts.

import type { Customer } from '@suki/domain';

/** The app's single clock — the day the shop is 'open' for this build. Same on every device. */
export const APP_TODAY = '2025-09-15T09:00:00.000Z'; // a kinsenas, deliberately

export const STORE = {
  storeName: 'Rosa Sari-Sari Store',
  barangay: 'Barangay Daro, Dumaguete',
  defaultReorderPoint: 6,
} as const;

// --- Customers ------------------------------------------------------------
// 40 real Filipino names, ~15 will carry a balance via the ledger below.
export const CUSTOMERS: Customer[] = [
  { id: 'c01', name: 'Aling Bebang Ramirez',        purok: 'Purok Mabini',       paydayPreference: 'kinsenas',  createdAt: '2024-01-06T00:00:00.000Z' },
  { id: 'c02', name: 'Mang Jomar Alcantara',        purok: 'Purok Rizal',        paydayPreference: 'katapusan', createdAt: '2024-01-06T00:00:00.000Z' },
  { id: 'c03', name: 'Nay Cora Villafuerte',        purok: 'Purok Bonifacio',    paydayPreference: 'kinsenas',  createdAt: '2024-01-06T00:00:00.000Z' },
  { id: 'c04', name: 'Ma. Cristina Villanueva-Deloso', purok: 'Purok Mabini',    paydayPreference: 'katapusan', createdAt: '2024-01-06T00:00:00.000Z' },
  { id: 'c05', name: 'Tatay Ernesto Balogbog',      purok: 'Purok Aguinaldo',    paydayPreference: 'katapusan', createdAt: '2024-01-06T00:00:00.000Z' },
  { id: 'c06', name: 'Aling Nena Sumalpong',        purok: 'Purok Rizal',        paydayPreference: 'kinsenas',  createdAt: '2024-01-08T00:00:00.000Z' },
  { id: 'c07', name: 'Kuya Rico Manlangit',         purok: 'Purok Bonifacio',    paydayPreference: 'katapusan', createdAt: '2024-01-08T00:00:00.000Z' },
  { id: 'c08', name: 'Ate Malou Enriquez',          purok: 'Purok Aguinaldo',    paydayPreference: 'kinsenas',  createdAt: '2024-01-08T00:00:00.000Z' },
  { id: 'c09', name: 'Manoy Tolits Piscos',         purok: 'Purok Mabini',       paydayPreference: 'either',    createdAt: '2024-01-10T00:00:00.000Z' },
  { id: 'c10', name: 'Aling Fely Tumapon',          purok: 'Purok Rizal',        paydayPreference: 'kinsenas',  createdAt: '2024-01-10T00:00:00.000Z' },
  { id: 'c11', name: 'Mang Berting Alcuino',        purok: 'Purok Bonifacio',    paydayPreference: 'katapusan', createdAt: '2024-01-10T00:00:00.000Z' },
  { id: 'c12', name: 'Ate Rowena Kilat',            purok: 'Purok Aguinaldo',    paydayPreference: 'kinsenas',  createdAt: '2024-01-15T00:00:00.000Z' },
  { id: 'c13', name: 'Nong Doming Yburan',          purok: 'Purok Mabini',       paydayPreference: 'katapusan', createdAt: '2024-01-15T00:00:00.000Z' },
  { id: 'c14', name: 'Aling Vicky Lomotos',         purok: 'Purok Rizal',        paydayPreference: 'kinsenas',  createdAt: '2024-01-15T00:00:00.000Z' },
  { id: 'c15', name: 'Manang Susing Salvahan',      purok: 'Purok Bonifacio',    paydayPreference: 'either',    createdAt: '2024-01-20T00:00:00.000Z' },
  { id: 'c16', name: 'Kuya Jose Panugaling',        purok: 'Purok Aguinaldo',    paydayPreference: 'katapusan', createdAt: '2024-01-20T00:00:00.000Z' },
  { id: 'c17', name: 'Aling Meding Bacolod',        purok: 'Purok Mabini',       paydayPreference: 'kinsenas',  createdAt: '2024-01-22T00:00:00.000Z' },
  { id: 'c18', name: 'Mang Tino Elemento',          purok: 'Purok Rizal',        paydayPreference: 'katapusan', createdAt: '2024-01-22T00:00:00.000Z' },
  { id: 'c19', name: 'Nay Beth Tumangkeng',         purok: 'Purok Bonifacio',    paydayPreference: 'kinsenas',  createdAt: '2024-01-25T00:00:00.000Z' },
  { id: 'c20', name: 'Tatay Silo Amistoso',         purok: 'Purok Aguinaldo',    paydayPreference: 'katapusan', createdAt: '2024-01-25T00:00:00.000Z' },
  { id: 'c21', name: 'Ate Jinky Pahayahay',         purok: 'Purok Mabini',       paydayPreference: 'kinsenas',  createdAt: '2024-02-01T00:00:00.000Z' },
  { id: 'c22', name: 'Manoy Pading Cabahug',        purok: 'Purok Rizal',        paydayPreference: 'katapusan', createdAt: '2024-02-01T00:00:00.000Z' },
  { id: 'c23', name: 'Aling Delia Alvior',          purok: 'Purok Bonifacio',    paydayPreference: 'kinsenas',  createdAt: '2024-02-05T00:00:00.000Z' },
  { id: 'c24', name: 'Kuya Ramil Sagnoy',           purok: 'Purok Aguinaldo',    paydayPreference: 'katapusan', createdAt: '2024-02-05T00:00:00.000Z' },
  { id: 'c25', name: 'Mang Toto Pactoranan',        purok: 'Purok Mabini',       paydayPreference: 'either',    createdAt: '2024-02-08T00:00:00.000Z' },
  { id: 'c26', name: 'Ate Lorna Baldado',           purok: 'Purok Rizal',        paydayPreference: 'kinsenas',  createdAt: '2024-02-12T00:00:00.000Z' },
  { id: 'c27', name: 'Nong Iking Estrellado',       purok: 'Purok Bonifacio',    paydayPreference: 'katapusan', createdAt: '2024-02-12T00:00:00.000Z' },
  { id: 'c28', name: 'Manang Belen Estoconing',     purok: 'Purok Aguinaldo',    paydayPreference: 'kinsenas',  createdAt: '2024-02-15T00:00:00.000Z' },
  { id: 'c29', name: 'Kuya Boyet Palamos',          purok: 'Purok Mabini',       paydayPreference: 'katapusan', createdAt: '2024-02-15T00:00:00.000Z' },
  { id: 'c30', name: 'Ate Jenalyn Kinilaw',         purok: 'Purok Rizal',        paydayPreference: 'kinsenas',  createdAt: '2024-02-20T00:00:00.000Z' },
  { id: 'c31', name: 'Nay Puring Ontuca',           purok: 'Purok Bonifacio',    paydayPreference: 'katapusan', createdAt: '2024-02-20T00:00:00.000Z' },
  { id: 'c32', name: 'Tatay Warlie Bughaw',         purok: 'Purok Aguinaldo',    paydayPreference: 'either',    createdAt: '2024-02-25T00:00:00.000Z' },
  { id: 'c33', name: 'Aling Norma Amistad',         purok: 'Purok Mabini',       paydayPreference: 'kinsenas',  createdAt: '2024-03-01T00:00:00.000Z' },
  { id: 'c34', name: 'Mang Talyo Suzara',           purok: 'Purok Rizal',        paydayPreference: 'katapusan', createdAt: '2024-03-01T00:00:00.000Z' },
  { id: 'c35', name: 'Ate Grace Manikan',           purok: 'Purok Bonifacio',    paydayPreference: 'kinsenas',  createdAt: '2024-03-08T00:00:00.000Z' },
  { id: 'c36', name: 'Kuya Dennis Balbon',          purok: 'Purok Aguinaldo',    paydayPreference: 'katapusan', createdAt: '2024-03-08T00:00:00.000Z' },
  { id: 'c37', name: 'Manoy Sabas Umbay',           purok: 'Purok Mabini',       paydayPreference: 'kinsenas',  createdAt: '2024-03-15T00:00:00.000Z' },
  { id: 'c38', name: 'Nay Lita Panuncialman',       purok: 'Purok Rizal',        paydayPreference: 'katapusan', createdAt: '2024-03-15T00:00:00.000Z' },
  { id: 'c39', name: 'Aling Perla Sagario',         purok: 'Purok Bonifacio',    paydayPreference: 'kinsenas',  createdAt: '2024-03-20T00:00:00.000Z' },
  { id: 'c40', name: 'Tatay Kanor Baldevieso',      purok: 'Purok Aguinaldo',    paydayPreference: 'either',    createdAt: '2024-03-20T00:00:00.000Z' },
];
