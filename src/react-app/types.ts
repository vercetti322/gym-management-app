export type Member = {
  id: number;
  name: string;
  phone: string;
  hasPhoto: boolean;
  isActive: boolean;
  address: string | null;
  profession: string | null;
  visitTime: 'AM' | 'PM' | null;
  planMonths: number | null;
  price: number | null;
  expiry: string | null;
  daysLeft: number | null;
  paymentDone: boolean;
  paymentDate: string | null;
  paymentMode: string | null;
};
