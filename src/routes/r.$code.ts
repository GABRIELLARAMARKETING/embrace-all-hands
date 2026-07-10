import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Atalho público /r/:code → /api/public/r/:code
 * O endpoint interno registra o clique e redireciona para /auth?ref=CODE.
 */
export const Route = createFileRoute("/r/$code")({
  beforeLoad: ({ params }) => {
    throw redirect({
      href: `/api/public/r/${encodeURIComponent(params.code)}`,
    });
  },
  component: () => null,
});
