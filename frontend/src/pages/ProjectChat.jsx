import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import useAuthStore from '../store/authStore.js';
import { useProjectSocket } from '../hooks/useProjectSocket.js';
import GuestBanner from '../components/GuestBanner.jsx';

const ROLE_HOME = { client: '/client', freelancer: '/freelancer', admin: '/admin' };

const MILESTONE_LABELS = {
  'milestone:funded':       { icon: '💰', text: 'Milestone funded' },
  'milestone:started':      { icon: '🚀', text: 'Work started' },
  'milestone:submitted':    { icon: '📬', text: 'Work submitted for review' },
  'milestone:approved':     { icon: '✅', text: 'Milestone approved — payment released' },
  'milestone:disputed':     { icon: '⚠️', text: 'Dispute raised' },
  'milestone:refunded':     { icon: '↩️', text: 'Refund processed' },
  'milestone:auto_refunded':{ icon: '↩️', text: 'Auto-refunded by admin' },
  'milestone:cancelled':    { icon: '🚫', text: 'Milestone cancelled' },
};

function MilestoneNotification({ event, milestone }) {
  const info = MILESTONE_LABELS[event] ?? { icon: '🔔', text: event };
  return (
    <div className="flex justify-center my-2">
      <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs text-indigo-700">
        {info.icon} {info.text}{milestone?.title ? ` — ${milestone.title}` : ''}
      </span>
    </div>
  );
}

function AttachmentChip({ url }) {
  const name = url.split('/').pop().split('?')[0];
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-200"
    >
      {isImage ? '🖼' : '📎'} {decodeURIComponent(name).slice(0, 30)}
    </a>
  );
}

export default function ProjectChat() {
  const { projectId } = useParams();
  const navigate      = useNavigate();
  const { user }      = useAuthStore();

  const [project,     setProject]     = useState(null);
  const [messages,    setMessages]    = useState([]);     // { type: 'msg'|'event', ... }
  const [input,       setInput]       = useState('');
  const [uploading,   setUploading]   = useState(false);
  const [uploadPct,   setUploadPct]   = useState(0);
  const [pendingFiles,setPendingFiles]= useState([]);     // { url, name } queued before send
  const [typingName,  setTypingName]  = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [error,       setError]       = useState('');

  const bottomRef    = useRef(null);
  const typingTimer  = useRef(null);
  const fileInputRef = useRef(null);

  // ── Load project + message history ──────────────────────────────────────────
  useEffect(() => {
    api.get(`/api/projects/${projectId}`)
      .then(r => setProject(r.data.project))
      .catch(() => setError('Could not load project'));

    api.get(`/api/projects/${projectId}/messages`)
      .then(r => setMessages(r.data.messages.map(m => ({ type: 'msg', ...m }))))
      .catch(() => {});
  }, [projectId]);

  // ── Auto-scroll to bottom ────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Socket callbacks ─────────────────────────────────────────────────────────
  const handleMessage = useCallback(msg => {
    setMessages(prev => [...prev, { type: 'msg', ...msg }]);
  }, []);

  const handleTyping = useCallback(({ name }) => {
    setTypingName(name);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTypingName(''), 3000);
  }, []);

  const handleMilestoneEvent = useCallback((event, data) => {
    setMessages(prev => [...prev, { type: 'event', event, milestone: data.milestone }]);
  }, []);

  const handlePresence = useCallback((kind, { userId }) => {
    setOnlineUsers(prev => {
      const next = new Set(prev);
      kind === 'joined' ? next.add(userId) : next.delete(userId);
      return next;
    });
  }, []);

  const { connected, sendMessage, sendTyping } = useProjectSocket({
    projectId,
    onMessage:        handleMessage,
    onTyping:         handleTyping,
    onMilestoneEvent: handleMilestoneEvent,
    onPresence:       handlePresence,
  });

  // ── File upload ──────────────────────────────────────────────────────────────
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    setUploadPct(0);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/api/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: evt => setUploadPct(Math.round((evt.loaded / evt.total) * 100)),
      });
      setPendingFiles(prev => [...prev, { url: data.url, name: data.originalName }]);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Upload failed');
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
  function handleSend() {
    if (!input.trim() && pendingFiles.length === 0) return;
    sendMessage({
      content:     input.trim(),
      attachments: pendingFiles.map(f => f.url),
    });
    setInput('');
    setPendingFiles([]);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInputChange(e) {
    setInput(e.target.value);
    sendTyping();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const isOwnMessage = msg => msg.senderId?._id === user?._id || msg.senderId === user?._id;

  const otherParty = project
    ? (user?.role === 'client' ? project.freelancerId : project.clientId)
    : null;
  const otherOnline = otherParty && onlineUsers.has(
    typeof otherParty === 'object' ? otherParty._id?.toString() : otherParty?.toString()
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <GuestBanner />

      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(ROLE_HOME[user?.role] ?? '/login')}
            className="rounded-lg border border-gray-200 px-2.5 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 leading-tight">
              {project?.title ?? 'Loading…'}
            </h1>
            <p className="text-xs text-gray-500">Project Chat</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {otherOnline && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Online
            </span>
          )}
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-400'}`} title={connected ? 'Connected' : 'Disconnected'} />
        </div>
      </header>

      {/* Disconnect banner */}
      {!connected && (
        <div className="flex items-center justify-center gap-2 bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800">
          <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
          Reconnecting… Messages will resume when the connection is restored.
        </div>
      )}

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-8">No messages yet. Say hello!</p>
        )}

        {messages.map((item, i) => {
          if (item.type === 'event') {
            return <MilestoneNotification key={i} event={item.event} milestone={item.milestone} />;
          }

          const own = isOwnMessage(item);
          return (
            <div key={item._id ?? i} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-2xl px-3 py-2 shadow-sm ${own ? 'bg-indigo-600 text-white' : 'bg-white text-gray-900 border'}`}>
                {!own && (
                  <p className="mb-0.5 text-xs font-semibold text-indigo-500">
                    {item.senderId?.name ?? 'User'}
                  </p>
                )}
                {item.content && <p className="text-sm whitespace-pre-wrap">{item.content}</p>}
                {item.attachments?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.attachments.map((url, j) => <AttachmentChip key={j} url={url} />)}
                  </div>
                )}
                <p className={`mt-0.5 text-right text-[10px] ${own ? 'text-indigo-200' : 'text-gray-400'}`}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {typingName && (
        <div className="px-4 pb-1 text-xs text-gray-500 italic">{typingName} is typing…</div>
      )}

      {/* Pending file chips */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 pb-1">
          {pendingFiles.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs text-indigo-700">
              📎 {f.name.slice(0, 24)}
              <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-indigo-400 hover:text-red-500">✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="px-4 pb-1">
          <div className="h-1 w-full rounded bg-gray-200">
            <div className="h-1 rounded bg-indigo-500 transition-all" style={{ width: `${uploadPct}%` }} />
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t bg-white px-4 py-3 flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,.pdf,.zip,.docx,.xlsx"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50 shrink-0"
          title="Attach file"
        >
          📎
        </button>
        <textarea
          rows={1}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          style={{ maxHeight: '6rem', overflowY: 'auto' }}
        />
        <button
          onClick={handleSend}
          disabled={!connected || (input.trim() === '' && pendingFiles.length === 0)}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
