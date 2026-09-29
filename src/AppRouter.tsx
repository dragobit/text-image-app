import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { Header } from "./components/Header";

import Index from "./pages/Index";
import Library from "./pages/Library";
import Settings from "./pages/Settings";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";

// The bundle lives at <mount>/assets/index-*.js, so the directory above
// /assets/ is where the app is mounted. Deriving the basename at runtime
// (rather than baking it into the build) keeps one dist/ deployable to a
// domain root and to subpaths like GitHub Pages' /<repo>/ at once.
function appBasename(): string {
  const script = document.querySelector('script[src*="/assets/"]');
  if (!(script instanceof HTMLScriptElement)) return '/';
  const pathname = new URL(script.src, window.location.href).pathname;
  return pathname.replace(/\/assets\/.*$/, '') || '/';
}

export function AppRouter() {
  return (
    <BrowserRouter basename={appBasename()}>
      <ScrollToTop />
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<Settings />} />
          {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
          <Route path="/:nip19" element={<NIP19Page />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
export default AppRouter;