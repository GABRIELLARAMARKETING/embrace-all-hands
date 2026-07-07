import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      navigate({ to: data.session ? "/game" : "/login", replace: true });
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-900 via-indigo-950 to-fuchsia-950 text-white/60 text-sm">
      Carregando...
    </div>
  );
}
