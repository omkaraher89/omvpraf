import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { fetchSessionUser, hydrateWorkspaceFromServer } from './services/workspaceApi';
import './index.css';

async function boot() {
  // The server session decides who is signed in; then restore that account's
  // workspace from D1 before the app reads its local cache.
  const user = await fetchSessionUser();
  if (user) {
    await hydrateWorkspaceFromServer().catch(() => false);
  }

  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <App initialUser={user} />
    </ErrorBoundary>
  );
}

void boot();
