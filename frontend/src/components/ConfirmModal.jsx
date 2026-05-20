// Generic confirmation modal — supports optional textarea for a reason field.
// Usage:
//   <ConfirmModal
//     title="Cancel milestone"
//     message="This cannot be undone."
//     confirmText="Yes, cancel"
//     destructive
//     onConfirm={() => doTheThing()}
//     onClose={() => setModal(null)}
//   />
//
// For dispute / reason variants, pass withReason={true}:
//   <ConfirmModal withReason reasonLabel="Describe the issue" onConfirm={(reason) => ...} />

import { useState } from 'react';

export default function ConfirmModal({
  title,
  message,
  confirmText  = 'Confirm',
  destructive  = false,
  withReason   = false,
  reasonLabel  = 'Reason',
  onConfirm,
  onClose,
}) {
  const [reason,     setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canConfirm = !withReason || reason.trim().length >= 10;

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-base font-semibold text-gray-900">{title}</h3>
        {message && <p className="mb-4 text-sm text-gray-500">{message}</p>}

        {withReason && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {reasonLabel}
              <span className="text-gray-400 font-normal ml-1">(min 10 chars)</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Describe the issue…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
              destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {submitting ? 'Please wait…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
