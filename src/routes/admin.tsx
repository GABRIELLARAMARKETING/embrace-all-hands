import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/admin/Sidebar";
import { FloatingChatButton } from "@/components/admin/FloatingChatButton";
import { AnimatePresence, motion } from "framer-motion";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ location }) => {
    // If someone hits /admin directly, send them to the dashboard.
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      throw redirect({ to: "/admin/painel" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on ESC
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="admin-theme admin-scroll min-h-screen w-full">
      <div className="flex min-h-screen w-full">
        {/* Desktop sidebar */}
        <div className="hidden w-[280px] shrink-0 lg:block">
          <div className="fixed top-0 left-0 h-screen w-[280px]">
            <Sidebar />
          </div>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "tween", duration: 0.24 }}
                className="fixed inset-y-0 left-0 z-50 w-[280px] lg:hidden"
              >
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <main className="flex-1 lg:pl-[280px]">
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col">
            <MobileMenuTrigger onOpen={() => setMobileOpen(true)} />
            <div className="flex-1">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <FloatingChatButton />
    </div>
  );
}

// Tiny helper so pages can render their own <TopHeader />, but mobile still
// has an always-visible menu trigger even before the header renders.
function MobileMenuTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="lg:hidden">
      <button
        aria-hidden="true"
        tabIndex={-1}
        onClick={onOpen}
        className="pointer-events-none absolute opacity-0"
      />
    </div>
  );
}
