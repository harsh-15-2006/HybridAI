// Domain types shared by the app, seed scripts and tests.
// Prices are Indian rupees. Money is stored as integer minor units (paise, in fields named
// "...Cents") so Security Rules can compare exactly.

export type CategoryId = 'audio' | 'computers' | 'air' | 'phones' | 'wearables' | 'accessories';

export interface Spec {
  key: string;
  label: string;
  value: string;
  /** Numeric form for honest comparison. */
  num?: number;
  /** Which direction is generally preferable, when that is not a matter of taste. */
  better?: 'higher' | 'lower';
  glossaryKey?: string;
}

export type ArtKind =
  | 'over-ear' | 'earbuds' | 'speaker' | 'laptop' | 'tablet' | 'purifier' | 'fan' | 'humidifier'
  | 'phone' | 'watch' | 'band' | 'keyboard' | 'mouse' | 'powerbank' | 'webcam' | 'monitor';

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: CategoryId;
  type: string;
  priceCents: number;
  currency: 'INR';
  summary: string;
  description: string;
  features: string[];
  specs: Spec[];
  stock: number;
  images: string[];
  art: ArtKind;
  glossaryKeys: string[];
  ratingSummary: { count: number; average: number };
  /** Everything seeded is demonstration data. */
  sample: boolean;
  lastOrderId?: string;
}

export interface Review {
  id: string;
  productId: string;
  uid: string;
  orderId?: string;
  rating: number;
  text: string;
  status: 'pending' | 'published' | 'rejected';
  sample: boolean;
  createdAtMs: number;
}

export interface ShippingOption {
  label: string;
  priceCents: number;
  minDays: number;
  maxDays: number;
}

export interface ShippingConfig {
  options: Record<string, ShippingOption>;
}

export interface StoreConfig {
  returnWindowDays: number;
}

export interface Address {
  name: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  unitPriceCents: number;
}

export type OrderStatus = 'placed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';

export interface StatusEvent {
  status: OrderStatus;
  atMs: number;
  by: 'shopper' | 'operator';
}

export interface Order {
  id: string;
  uid: string;
  items: OrderItem[];
  /** productId -> qty. Lets Security Rules check each stock decrease. */
  quantities: Record<string, number>;
  subtotalCents: number;
  shipping: { optionId: string; priceCents: number; label: string; minDays: number; maxDays: number };
  totalCents: number;
  address: Address;
  payment: { provider: 'simulated'; status: 'simulated_ok' };
  status: OrderStatus;
  statusHistory: StatusEvent[];
  createdAtMs: number;
  deliveredAtMs: number | null;
}

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'refunded_simulated';

export interface ReturnRequest {
  id: string;
  orderId: string;
  uid: string;
  reason: string;
  status: ReturnStatus;
  createdAtMs: number;
}

export interface Ticket {
  id: string;
  uid: string;
  orderId: string | null;
  message: string;
  replies: { by: 'operator'; text: string; atMs: number }[];
  status: 'open' | 'answered' | 'closed';
  createdAtMs: number;
}

export interface CartLine {
  productId: string;
  qty: number;
}

export type PrivacySetting = 'device' | 'ask' | 'cloud';

export interface Profile {
  budget: string;
  uses: string;
  comfort: string;
  space: string;
}
