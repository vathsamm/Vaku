import React, { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Trash2, CheckCircle2, RefreshCw, Eye, EyeOff, Radio } from 'lucide-react';

interface KaggleUserAccount {
  id: string;
  username: string;
  key?: string;
  keyMasked?: string;
  enabled?: boolean;
  addedAt?: number;
  status?: 'ready' | 'invalid' | 'unknown' | 'testing';
}

interface KaggleGpuSettingsPanelProps {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  currentUserEmail?: string;
}

export const KaggleGpuSettingsPanel: React.FC<KaggleGpuSettingsPanelProps> = ({ onToast }) => {
  const [accounts, setAccounts] = useState<KaggleUserAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [newUsername, setNewUsername] = useState<string>('');
  const [newApiKey, setNewApiKey] = useState<string>('');
  const [showNewKey, setShowNewKey] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  const [visibleKeyIds, setVisibleKeyIds] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/kaggle/user_accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeyIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = newUsername.trim();
    const k = newApiKey.trim();
    if (!u || !k) {
      onToast("Username and API key are required", "warning");
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch('/api/kaggle/user_accounts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, key: k })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onToast(`Added @${u}`, "success");
        setNewUsername('');
        setNewApiKey('');
        fetchAccounts();
      } else {
        onToast(data.error || "Failed to add credential", "error");
      }
    } catch (err: any) {
      onToast(err?.message || "Error adding credential", "error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteAccount = async (acc: KaggleUserAccount) => {
    setAccounts(prev => prev.filter(a => a.id !== acc.id));
    onToast(`Deleted @${acc.username}`, "info");

    try {
      await fetch('/api/kaggle/user_accounts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: acc.id, username: acc.username })
      });
    } catch (_) {}
  };

  const handleTestAccount = async (acc: KaggleUserAccount) => {
    setTestingId(acc.id);
    try {
      const res = await fetch('/api/kaggle/user_accounts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: acc.username, key: acc.key || '' })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onToast(`Verified @${acc.username}`, "success");
        setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, status: 'ready' } : a));
      } else {
        onToast(data.error || "Verification failed", "error");
      }
    } catch (err: any) {
      onToast(`Test failed: ${err.message}`, "error");
    } finally {
      setTestingId(null);
    }
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="p-4 bg-gray-950 border border-gray-800 rounded-2xl flex items-center justify-center gap-2 text-gray-400 text-xs">
        <RefreshCw size={13} className="animate-spin text-amber-400" />
        <span>Loading credentials...</span>
      </div>
    );
  }

  return (
    <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-2xl space-y-4 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Key size={14} />
          </div>
          <span className="font-bold text-white text-xs">Kaggle Credentials</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-950/60 text-amber-300 border border-amber-800/40">
          {accounts.length} {accounts.length === 1 ? 'Account' : 'Accounts'}
        </span>
      </div>

      <div className="space-y-2">
        {accounts.length === 0 ? (
          <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800/80 text-center text-gray-500 text-xs">
            No credentials saved. Add your Kaggle username and API key below.
          </div>
        ) : (
          accounts.map(acc => {
            const isVisible = Boolean(visibleKeyIds[acc.id]);
            const isTesting = testingId === acc.id;
            const rawKey = acc.key || '';
            const displayKey = isVisible 
              ? rawKey 
              : (rawKey ? `${rawKey.slice(0, 4)}••••••••${rawKey.slice(-4)}` : '••••••••••••');

            return (
              <div 
                key={acc.id} 
                className="p-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700/80 transition flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white font-mono truncate">
                      @{acc.username}
                    </span>
                    {acc.status === 'ready' && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                        <CheckCircle2 size={11} />
                        <span>Ready</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-gray-400">
                    <span className="truncate">{displayKey}</span>
                    {rawKey && (
                      <button
                        type="button"
                        onClick={() => toggleKeyVisibility(acc.id)}
                        className="text-gray-500 hover:text-gray-300 p-0.5 transition cursor-pointer"
                        title={isVisible ? 'Hide key' : 'Show key'}
                      >
                        {isVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTestAccount(acc)}
                    disabled={isTesting}
                    className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white transition active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Test Credential"
                  >
                    <Radio size={13} className={isTesting ? 'animate-pulse text-amber-400' : 'text-gray-400'} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(acc)}
                    className="p-1.5 rounded-lg bg-red-950/30 hover:bg-red-950/60 border border-red-900/40 text-red-400 hover:text-red-300 transition active:scale-95 cursor-pointer"
                    title="Delete Credential"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleAddAccount} className="pt-2 border-t border-gray-900 space-y-2.5">
        <span className="text-[11px] font-bold text-gray-300 block">
          Add New Credential
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Username"
            className="w-full bg-gray-900 border border-gray-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-gray-100 outline-none transition"
          />

          <div className="relative flex items-center">
            <input
              type={showNewKey ? 'text' : 'password'}
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              placeholder="API Key"
              className="w-full bg-gray-900 border border-gray-800 focus:border-amber-500 rounded-xl pl-3 pr-8 py-2 text-xs font-mono text-gray-100 outline-none transition"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowNewKey(!showNewKey)}
              className="absolute right-2 text-gray-400 hover:text-gray-200 transition p-0.5 cursor-pointer"
            >
              {showNewKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isAdding || !newUsername.trim() || !newApiKey.trim()}
          className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
        >
          {isAdding ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              <span>Adding...</span>
            </>
          ) : (
            <>
              <Plus size={13} />
              <span>Add Credential</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
