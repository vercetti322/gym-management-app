export type MemberRow = {
  id: number;
  name: string;
  phone: string;
  hasPhoto: number;
  isActive: number;
  address: string | null;
  profession: string | null;
  visitTime: 'AM' | 'PM' | null;
  planMonths: number | null;
  price: number | null;
  expiry: string | null;
  daysLeft: number | null;
  paymentDone: number | null;
  paymentDate: string | null;
  paymentMode: string | null;
};