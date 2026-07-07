import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";
import { Sidebar } from "@/components/admin/Sidebar";
import { FloatingChatButton } from "@/components/admin/FloatingChatButton";
import { AnimatePresence, motion } from "framer-motion";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      throw redirect({ to: "/admin/painel" });
    }
  },
  component: AdminLayout,
});

interface AdminUICtx {
  openMobileMenu: () => void;
}
const AdminUIContext = createContext<AdminUICtx>({ openMobileMenu: () => {} });

export const useAdminUI = () => useContext(AdminUIContext);

function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <AdminUIContext.Provider value={{ openMobileMenu: () => setMobileOpen(true) }}>
      <div className="admin-theme admin-scroll min-h-screen w-full">
        <div className="flex min-h-screen w-full">
          <div className="hidden w-[240px] shrink-0 lg:block">
            <div className="fixed top-0 left-0 h-screen w-[240px]">
              <Sidebar />
            </div>
          </div>

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
                  className="fixed inset-y-0 left-0 z-50 w-[240px] lg:hidden"
                >
                  <Sidebar onNavigate={() => setMobileOpen(false)} />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <main className="flex-1 lg:pl-[240px]">
            <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
              <Outlet />
            </div>
          </main>
        </div>
        <FloatingChatButton />
      </div>
    </AdminUIContext.Provider>
  );
}
