// Cloudflare Pages Functions adapter.
// Reuses the exact same API implementation as the Worker (worker/index.ts), so
// /api/auth/*, /api/workspace and the market proxy behave identically on Pages.
import { handleApiRequest } from '../../worker/index.ts';

type PagesContext = {
  request: Request;
  env: Record<string, unknown>;
  next: () => Promise<Response>;
};

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const response = await handleApiRequest(context.request, context.env as never);
  if (response) return response;
  return context.next();
};
