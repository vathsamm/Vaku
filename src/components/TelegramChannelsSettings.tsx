import React, { useState, useEffect } from 'react';
import { Send, Key, Hash, Save, RefreshCw, CheckCircle2, Eye, EyeOff, Radio } from 'lucide-react';

interface TelegramConfig {
  token: string;
  channelId: string;
}

interface TelegramChannelsSettingsProps {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  isAdmin: boolean;
}

export const TelegramChannelsSettings: React.FC<TelegramChannelsSettingsProps> = ({ onToast }) => {
  const [config, setConfig] = useState<TelegramConfig>({
    token: '8411745208:AAGxVZ2xetTkmq4499frMyRbGsc_i2xAm3Q',
    channelId: '-1004458129874'
  });
  const [showToken, setShowToken] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [pulling, setPulling] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        setLoading(true);
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            const cfg = data.config || data;
            setConfig({
              token: cfg.token || cfg.telegram_bot_token || '8411745208:AAGxVZ2xetTkmq4499frMyRbGsc_i2xAm3Q',
              channelId: cfg.channelId || cfg.telegram_chat_id || cfg.telegram_channel_id || cfg.videoStorageChannel || '-1004458129874'
            });
          }
        }
      } catch (err) {
        console.error("Failed to load Telegram configuration:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadConfig();
    return () => { isMounted = false; };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.token.trim() || !config.channelId.trim()) {
      onToast("Bot token and channel ID are required", "warning");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_bot_token: config.token.trim(),
          telegram_chat_id: config.channelId.trim(),
          telegram_channel_id: config.channelId.trim(),
          videoStorageChannel: config.channelId.trim()
        })
      });

      const data = await res.json();
      if (res.ok && (data.success || data.ok)) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
        onToast("Telegram credentials saved!", "success");
      } else {
        onToast(data.error || "Failed to save settings", "error");
      }
    } catch (err: any) {
      onToast(err?.message || "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/sync/trigger', { method: 'POST' });
      const data = await res.json();
      if (res.ok && (data.success || data.ok)) {
        onToast("Connected to Telegram channel successfully!", "success");
      } else {
        onToast(data.error || "Connection failed. Check token & admin rights.", "error");
      }
    } catch (err: any) {
      onToast(err?.message || "Connection check error", "error");
    } finally {
      setTesting(false);
    }
  };

  const handlePullPin = async () => {
    setPulling(true);
    try {
      const res = await fetch('/api/telegram/sync_from_channel', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        onToast("Database restored from channel pin!", "success");
        setTimeout(() => window.location.reload(), 800);
      } else {
        onToast(data.error || "Failed to pull from channel", "error");
      }
    } catch (err: any) {
      onToast(err?.message || "Restore network error", "error");
    } finally {
      setPulling(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-950 border border-gray-800 rounded-2xl flex items-center justify-center gap-2 text-gray-400 text-xs">
        <RefreshCw size={13} className="animate-spin text-cyan-400" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-2xl space-y-3.5 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Send size={14} />
          </div>
          <span className="font-bold text-white text-xs">Telegram Storage</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Active
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-300 flex items-center gap-1.5">
            <Key size={12} className="text-cyan-400" />
            <span>Token</span>
          </label>
          <div className="relative flex items-center">
            <input
              type={showToken ? 'text' : 'password'}
              value={config.token}
              onChange={(e) => setConfig({ ...config, token: e.target.value })}
              placeholder="8411745208:AA..."
              className="w-full bg-gray-900 border border-gray-800 focus:border-cyan-500 rounded-xl pl-3 pr-9 py-2 text-xs font-mono text-gray-100 outline-none transition"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2.5 text-gray-400 hover:text-gray-200 transition p-0.5 cursor-pointer"
              title={showToken ? 'Hide Token' : 'Show Token'}
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-300 flex items-center gap-1.5">
            <Hash size={12} className="text-purple-400" />
            <span>Channel ID</span>
          </label>
          <input
            type="text"
            value={config.channelId}
            onChange={(e) => setConfig({ ...config, channelId: e.target.value })}
            placeholder="-1004458129874"
            className="w-full bg-gray-900 border border-gray-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-mono text-gray-100 outline-none transition"
          />
        </div>

        <div className="pt-1 flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm ${
              savedSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            {saving ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : savedSuccess ? (
              <>
                <CheckCircle2 size={13} />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save size={13} />
                <span>Save</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="py-2 px-3 rounded-xl font-medium text-xs bg-gray-900 hover:bg-gray-850 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
            title="Test Connection"
          >
            <Radio size={12} className={testing ? 'animate-pulse text-cyan-400' : 'text-gray-400'} />
            <span>{testing ? 'Testing...' : 'Test'}</span>
          </button>
        </div>
      </form>

      <div className="pt-2 border-t border-gray-900">
        <button
          type="button"
          onClick={handlePullPin}
          disabled={pulling}
          className="w-full py-1.5 px-3 bg-gray-900 hover:bg-gray-850 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-gray-200 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={11} className={pulling ? 'animate-spin text-cyan-400' : ''} />
          <span>{pulling ? 'Restoring...' : 'Restore from Backup'}</span>
        </button>
      </div>
    </div>
  );
};
