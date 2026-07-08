import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";
import { Sidebar } from "@/components/admin/Sidebar";
import { FloatingChatButton } from "@/components/admin/FloatingChatButton";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gerente")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Login page é público
    if (location.pathname === "/gerente/login") return;

    if (location.pathname === "/gerente" || location.pathname === "/gerente/") {
      throw redirect({ to: "/gerente/painel" });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw redirect({ to: "/gerente/login" });
    }

    // RBAC: precisa ser admin ou super_admin
    const { data: rows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const roles = new Set((rows ?? []).map((r) => r.role));
    if (!roles.has("admin") && !roles.has("super_admin") && !roles.has("gerente")) {
      await supabase.auth.signOut();
      throw redirect({ to: "/gerente/login", search: { denied: "1" } as never });
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
          <div className="hidden w-[200px] shrink-0 lg:block">
            <div className="fixed top-0 left-0 h-screen w-[200px]">
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
                  className="fixed inset-y-0 left-0 z-50 w-[200px] lg:hidden"
                >
                  <Sidebar onNavigate={() => setMobileOpen(false)} />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <main className="flex-1 lg:pl-[200px]">
            <div className="mx-auto flex min-h-screen max-w-4xl flex-col">
              <Outlet />
            </div>
          </main>
        </div>
        <FloatingChatButton />
      </div>
    </AdminUIContext.Provider>
  );
}
