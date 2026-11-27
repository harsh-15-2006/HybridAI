import { Component, lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AiProvider } from '../ai/AiProvider.tsx';
import { CatalogueProvider } from '../data/catalogue.tsx';
import { Empty, Loading } from '../design/ui.tsx';
import { CartPage } from '../features/cart/Cart.tsx';
import { HomePage } from '../features/catalogue/Home.tsx';
import { CategoryPage, SearchPage } from '../features/catalogue/Listing.tsx';
import { ComparePage } from '../features/compare/Compare.tsx';
import { AboutAiPage, HelpPage, NotFoundPage } from '../features/info/Info.tsx';
import { ProductPage } from '../features/product/Product.tsx';
import { LedgerPage, YouPage } from '../features/you/You.tsx';
import { Layout } from './Layout.tsx';

const AskPage = lazy(() => import('../features/product/Ask.tsx'));
const CheckoutPage = lazy(() => import('../features/checkout/Checkout.tsx'));
const OrdersPage = lazy(() => import('../features/orders/Orders.tsx'));
const OrderPage = lazy(() => import('../features/orders/Order.tsx'));
const AdminPage = lazy(() => import('../features/admin/Admin.tsx'));

const later = (element: ReactNode) => <Suspense fallback={<Loading />}>{element}</Suspense>;

function Broken() {
  return (
    <Empty title="Something went wrong">
      <p>Reload the page. Your cart and preferences are saved on this device.</p>
      <button type="button" className="btn" onClick={() => location.assign('/')}>Reload the store</button>
    </Empty>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        // Page errors render inside the shell so navigation stays available.
        errorElement: <Broken />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/c/:category', element: <CategoryPage /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/p/:productId', element: <ProductPage /> },
          { path: '/p/:productId/ask', element: later(<AskPage />) },
          { path: '/compare', element: <ComparePage /> },
          { path: '/cart', element: <CartPage /> },
          { path: '/checkout', element: later(<CheckoutPage />) },
          { path: '/orders', element: later(<OrdersPage />) },
          { path: '/orders/:orderId', element: later(<OrderPage />) },
          { path: '/you', element: <YouPage /> },
          { path: '/ledger', element: <LedgerPage /> },
          { path: '/help', element: <HelpPage /> },
          { path: '/about-ai', element: <AboutAiPage /> },
          { path: '/admin', element: later(<AdminPage />) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <main className="wrap"><Broken /></main> : this.props.children;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <CatalogueProvider>
        <AiProvider>
          <RouterProvider router={router} />
        </AiProvider>
      </CatalogueProvider>
    </ErrorBoundary>
  );
}
