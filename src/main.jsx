import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { msalConfig } from './authConfig';

const queryClient = new QueryClient();

const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.initialize().then(() => {
  return msalInstance.handleRedirectPromise().catch(err => {
    console.warn("MSAL redirect error (can be ignored if using popup):", err);
    return null; // continue rendering
  });
}).then((response) => {
  // If redirect promise returned an account, set it
  if (response && response.account) {
    msalInstance.setActiveAccount(response.account);
  } else if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
    msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0]);
  }

  // Listen for sign-in event and set active account
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload.account) {
      const account = event.payload.account;
      msalInstance.setActiveAccount(account);
    }
  });

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Toaster position="bottom-right" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)', fontSize: '14px', fontWeight: 500 } }} />
      <QueryClientProvider client={queryClient}>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}).catch(err => {
  console.error("Critical app init error:", err);
});

