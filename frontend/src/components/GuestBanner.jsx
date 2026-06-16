import { useState } from 'react';
import useAuthStore from '../store/authStore.js';

// Persistent, dismissible banner shown only in guest/demo mode.
// Dismissal is remembered in sessionStorage so it stays hidden for the visit
// but reappears on a fresh session. Reads the user from the store, so pages
// just drop <GuestBanner /> at the top of their layout.
const DISMISS_KEY = 'flexhire:guestBannerDismissed';

const ROLE_LABEL = { client: 'Client', freelancer: 'Freelancer', admin: 'Admin' };

export default function GuestBanner() {
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1'
  );

  if (!user?.isGuest || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
      <span aria-hidden>👀</span>
      <span className="text-center">
        You're exploring FlexHire as a{' '}
        <strong>Demo {ROLE_LABEL[user.role] ?? 'User'}</strong> — some actions are disabled.
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="ml-1 rounded px-1.5 text-amber-500 hover:bg-amber-100 hover:text-amber-700"
      >
        ✕
      </button>
    </div>
  );
}
