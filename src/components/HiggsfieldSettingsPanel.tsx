import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, RefreshCw, Zap, Unlink, Key, ExternalLink, ShieldCheck, 
  AlertCircle, Globe, CheckCircle2, ArrowRight, ClipboardPaste, HelpCircle,
  Check, Info
} from 'lucide-react';
import { HiggsfieldConfig } from '../types';

interface HiggsfieldSettingsPanelProps {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onStatusChange?: (config: HiggsfieldConfig) => void;
}

export const HiggsfieldSettingsPanel: React.FC<HiggsfieldSettingsPanelProps> = ({
  onToast,
  onStatusChange
}) => {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [oauthRedirectInput, setOauthRedirectInput] = useState('');
  const [oauthLoginUrl, setOauthLoginUrl] = useState<string | null>(null);
  const [completingOAuth, setCompletingOAuth] = useState(false);
  const [startingOAuth, setStartingOAuth] = useState(false);
  const [activeTab, setActiveTab] = useState<'oauth' | 'apikey'>('oauth');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clipboardDetectedUrl, setClipboardDetectedUrl] = useState<string | null>(null);

  const getActiveUserEmail = (): string => {
    try {
      const raw = localStorage.getItem('remixx_auth_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && u.email) return u.email;
      }
    } catch (_) {}
    return '';
  };

  const [config, setConfig] = useState<HiggsfieldConfig>({
    connected: false,
    account_name: '',
    account_email: '',
    credits: 0,
    tier: 'Pro Creator',
    model_default: 'flux_3_video_edit'
  });

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/higgsfield/account_details');
      const data = await res.json();
      if (data.ok && data.higgsfield) {
        setConfig(data.higgsfield);
        if (onStatusChange) onStatusChange(data.higgsfield);
      }

      // Fetch OAuth status as well
      const oRes = await fetch('/api/higgsfield/oauth_status');
      const oData = await oRes.json();
      if (oData.ok && oData.loginUrl) {
        setOauthLoginUrl(oData.loginUrl);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    fetchStatus();

    const handleCustomUpdate = () => fetchStatus();
    window.addEventListener('higgsfield-status-updated', handleCustomUpdate);

    // Auto-polling for OAuth completion if not connected
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/higgsfield/oauth_status');
        const data = await res.json();
        if (data.ok) {
          if (data.loginUrl) {
            setOauthLoginUrl(data.loginUrl);
          }
          if (data.authenticated && !config.connected) {
            fetchStatus();
          }
        }
      } catch (_) {}
    }, 4000);

    // Window focus listener to automatically detect pasted localhost / code from clipboard
    const handleWindowFocus = async () => {
      if (config.connected) return;
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const clipText = await navigator.clipboard.readText();
          if (clipText && (clipText.includes('localhost:8765/callback') || clipText.includes('code='))) {
            const clean = clipText.trim();
            setClipboardDetectedUrl(clean);
            setOauthRedirectInput(clean);
            // Instant Auto-Link: automatically complete OAuth without requiring manual clicks!
            await triggerOAuthExchange(clean);
          }
        }
      } catch (_) {}
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('higgsfield-status-updated', handleCustomUpdate);
      window.removeEventListener('focus', handleWindowFocus);
      clearInterval(pollInterval);
    };
  }, [config.connected, fetchStatus]);

  const handleStartOAuth = async () => {
    setStartingOAuth(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/higgsfield/start_login', { method: 'POST' });
      const data = await res.json();
      if (data.ok && data.loginUrl) {
        setOauthLoginUrl(data.loginUrl);
        window.open(data.loginUrl, '_blank', 'noopener,noreferrer');
        onToast('Higgsfield sign-in tab opened! Log in, click Allow, then copy the address bar URL.', 'info');
      } else {
        throw new Error(data.error || 'Failed to initialize Higgsfield sign-in');
      }
    } catch (err: any) {
      setErrorMessage(err.message);
      onToast(err.message, 'error');
    } finally {
      setStartingOAuth(false);
    }
  };

  const triggerOAuthExchange = async (urlOrCodeToExchange: string) => {
    const input = urlOrCodeToExchange.trim();
    if (!input) {
      setErrorMessage('Please paste the redirect URL or authorization code from your browser');
      return;
    }

    setCompletingOAuth(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/higgsfield/complete_oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlOrCode: input })
      });
      const data = await res.json();

      if (res.ok && data.ok && data.higgsfield?.connected) {
        setConfig(data.higgsfield);
        if (onStatusChange) onStatusChange(data.higgsfield);
        window.dispatchEvent(new CustomEvent('higgsfield-status-updated', { detail: data.higgsfield }));
        onToast(`Authenticated successfully with Higgsfield! (${data.higgsfield.credits} credits)`, 'success');
        setOauthRedirectInput('');
        setClipboardDetectedUrl(null);
      } else {
        if (data.loginUrl) {
          setOauthLoginUrl(data.loginUrl);
        }
        const err = data.error || 'Failed to exchange authorization code';
        setErrorMessage(err);
        onToast(err, 'error');
      }
    } catch (err: any) {
      const msg = err.message || 'Connection error';
      setErrorMessage(msg);
      onToast(msg, 'error');
    } finally {
      setCompletingOAuth(false);
    }
  };

  const handleCompleteOAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await triggerOAuthExchange(oauthRedirectInput);
  };

  const handlePasteFromClipboardAndLink = async () => {
    try {
      let text = '';
      if (navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      }
      if (!text && oauthRedirectInput) {
        text = oauthRedirectInput;
      }
      if (text) {
        setOauthRedirectInput(text.trim());
        await triggerOAuthExchange(text.trim());
      } else {
        onToast('Clipboard is empty. Copy the URL from your browser address bar first.', 'warning');
      }
    } catch (_) {
      if (oauthRedirectInput.trim()) {
        await triggerOAuthExchange(oauthRedirectInput.trim());
      } else {
        onToast('Please paste the URL directly into the text box below.', 'info');
      }
    }
  };

  const handleConnectKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const key = apiKeyInput.trim();
    if (!key) {
      setErrorMessage('Please enter your Higgsfield API Key (KEY_ID:KEY_SECRET or Bearer token)');
      onToast('Higgsfield Key is required', 'warning');
      return;
    }

    setConnecting(true);
    setErrorMessage(null);

    try {
      const activeEmail = getActiveUserEmail();
      const res = await fetch('/api/higgsfield/set_key', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(activeEmail ? { 'x-user-email': activeEmail } : {})
        },
        body: JSON.stringify({
          key,
          email: activeEmail
        })
      });
      const data = await res.json();

      if (res.ok && data.ok && data.higgsfield?.connected) {
        setConfig(data.higgsfield);
        if (onStatusChange) onStatusChange(data.higgsfield);
        window.dispatchEvent(new CustomEvent('higgsfield-status-updated', { detail: data.higgsfield }));
        onToast(`Authenticated with Higgsfield! Credits: ${data.higgsfield.credits} cr`, 'success');
        setApiKeyInput('');
      } else {
        const err = data.error || 'Authentication rejected by Higgsfield MCP server';
        setErrorMessage(err);
        onToast(err, 'error');
      }
    } catch (err: any) {
      const msg = err.message || 'Network error connecting to Higgsfield';
      setErrorMessage(msg);
      onToast(msg, 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/higgsfield/disconnect', { method: 'POST' });
      setConfig(prev => ({ ...prev, connected: false, credits: 0, account_email: '', account_name: '' }));
      window.dispatchEvent(new CustomEvent('higgsfield-status-updated', { detail: { connected: false, credits: 0 } }));
      setErrorMessage(null);
      setOauthRedirectInput('');
      setClipboardDetectedUrl(null);
      onToast('Higgsfield disconnected', 'info');
    } catch (_) {
      onToast('Error disconnecting', 'error');
    }
  };

  const handleRefreshCredits = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/higgsfield/refresh_credits', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setConfig(prev => ({ 
          ...prev, 
          credits: data.credits, 
          tier: data.plan || prev.tier,
          account_email: data.email || prev.account_email 
        }));
        window.dispatchEvent(new CustomEvent('higgsfield-status-updated', { detail: { ...config, credits: data.credits } }));
        onToast(`Live Credits: ${typeof data.credits === 'number' ? (Number.isInteger(data.credits) ? data.credits : data.credits.toFixed(2)) : data.credits} cr`, 'info');
      }
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-400 gap-2">
        <RefreshCw size={22} className="animate-spin text-purple-400" />
        <span className="text-xs">Checking Higgsfield connection...</span>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-4 space-y-4 select-none">
      <div className="bg-gray-900/95 border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
        {/* Title & Real Status */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Higgsfield AI</h3>
              <p className="text-[11px] text-gray-400">CLI & Neural Generation Pipeline</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${config.connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className={`text-xs font-bold ${config.connected ? 'text-emerald-400' : 'text-rose-400'}`}>
              {config.connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>

        {/* Details: Account & Live Credits */}
        <div className="space-y-2.5 text-xs">
          {config.connected && (
            <div className="flex items-center justify-between py-1 border-b border-gray-800/60">
              <span className="text-gray-400">Authenticated Account:</span>
              <span className="font-mono font-bold text-white truncate max-w-[200px]">
                {config.account_email || getActiveUserEmail() || 'Active Session'}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-1">
            <span className="text-gray-400 flex items-center gap-1">
              <Zap size={13} className="text-amber-400 fill-amber-400" />
              Credits Remaining:
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-black text-amber-300">
                {typeof config.credits === 'number'
                  ? (Number.isInteger(config.credits) ? config.credits.toLocaleString() : config.credits.toFixed(2))
                  : 0} cr
              </span>
              {config.connected && config.tier && (
                <span className="px-1.5 py-0.5 rounded bg-purple-900/60 border border-purple-500/30 text-[10px] font-black uppercase tracking-wider text-purple-300">
                  {config.tier}
                </span>
              )}
              {config.connected && (
                <button
                  type="button"
                  onClick={handleRefreshCredits}
                  disabled={refreshing}
                  className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition cursor-pointer"
                  title="Query live balance via Higgsfield CLI"
                >
                  <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error notification */}
        {(errorMessage || config.lastAuthError) && !config.connected && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span className="leading-tight font-medium">{errorMessage || config.lastAuthError}</span>
          </div>
        )}

        {/* Action: Disconnect if connected, or Connect via Browser OAuth / API Key */}
        <div className="pt-1">
          {config.connected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="w-full py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-rose-950/60 border border-gray-700 hover:border-rose-700/60 text-gray-300 hover:text-rose-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Unlink size={14} />
              <span>Disconnect Higgsfield</span>
            </button>
          ) : (
            <div className="space-y-3">
              {/* Tab Selector */}
              <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('oauth')}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'oauth'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Globe size={13} />
                  <span>Browser Sign-In (OAuth)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('apikey')}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'apikey'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Key size={13} />
                  <span>API Key</span>
                </button>
              </div>

              {/* OAuth Tab */}
              {activeTab === 'oauth' && (
                <div className="space-y-3">
                  {/* Step-by-step guidance banner */}
                  <div className="p-3.5 bg-purple-950/20 border border-purple-500/25 rounded-xl space-y-2.5 text-xs">
                    <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                      <HelpCircle size={14} className="shrink-0" />
                      <span>How to Sign In (Quick 2-Step Flow)</span>
                    </div>

                    <ol className="space-y-1.5 text-[11px] text-gray-300 list-decimal pl-4 leading-relaxed">
                      <li>
                        Click <strong className="text-white">"Open Higgsfield Sign-In Page"</strong> below, sign in, and click <strong className="text-white">Allow</strong>.
                      </li>
                      <li>
                        When redirected, your browser will show <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300 font-mono text-[10px]">localhost refused to connect</code>. <span className="text-emerald-400 font-bold">This is completely normal!</span>
                      </li>
                      <li>
                        Copy the entire URL from your browser address bar, paste it below, and click <strong className="text-white">"Link Account"</strong>!
                      </li>
                    </ol>

                    <div className="pt-1 flex gap-2">
                      {oauthLoginUrl ? (
                        <a
                          href={oauthLoginUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition active:scale-98"
                        >
                          <ExternalLink size={14} />
                          <span>Open Higgsfield Sign-In Page</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartOAuth}
                          disabled={startingOAuth}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition active:scale-98"
                        >
                          {startingOAuth ? <RefreshCw size={14} className="animate-spin" /> : <Globe size={14} />}
                          <span>Start Higgsfield Sign-In</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleStartOAuth}
                        disabled={startingOAuth}
                        className="py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-98"
                        title="Restart clean session with fresh state"
                      >
                        <RefreshCw size={13} className={startingOAuth ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Restart</span>
                      </button>
                    </div>
                  </div>

                  {/* Auto-detected clipboard URL prompt */}
                  {clipboardDetectedUrl && !config.connected && (
                    <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-2 text-xs animate-in fade-in">
                      <div className="flex items-center gap-2 min-w-0">
                        <Check size={14} className="text-emerald-400 shrink-0" />
                        <span className="text-emerald-300 text-[11px] truncate font-medium">
                          Found sign-in code in clipboard!
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handlePasteFromClipboardAndLink}
                        disabled={completingOAuth}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black shrink-0 transition"
                      >
                        {completingOAuth ? 'Linking...' : 'Link Now'}
                      </button>
                    </div>
                  )}

                  {/* Manual Code / Redirect Input */}
                  <form onSubmit={handleCompleteOAuth} className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-300 font-semibold flex items-center gap-1">
                          <ClipboardPaste size={12} className="text-purple-400" />
                          Paste Browser Address Bar URL:
                        </span>
                        <button
                          type="button"
                          onClick={handlePasteFromClipboardAndLink}
                          disabled={completingOAuth}
                          className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-bold underline cursor-pointer"
                        >
                          <span>Paste & Link</span>
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={oauthRedirectInput}
                          onChange={(e) => {
                            setOauthRedirectInput(e.target.value);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          placeholder="http://localhost:8765/callback?code=... (from address bar)"
                          className="flex-1 px-3 py-2 rounded-xl bg-black/80 border border-gray-700 focus:border-purple-500 text-xs text-white placeholder-gray-500 font-mono outline-none"
                        />
                        <button
                          type="submit"
                          disabled={completingOAuth || !oauthRedirectInput.trim()}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black transition flex items-center gap-1 cursor-pointer disabled:opacity-50 active:scale-98"
                        >
                          {completingOAuth ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : (
                            <ArrowRight size={13} />
                          )}
                          <span>Link</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* API Key Tab */}
              {activeTab === 'apikey' && (
                <form onSubmit={handleConnectKey} className="space-y-3">
                  <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                      <Info size={13} />
                      <span>Direct Key Connection (No Redirects)</span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      You can also connect instantly by entering your Higgsfield API Key directly.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-300 font-bold flex items-center gap-1">
                        <Key size={12} className="text-purple-400" />
                        Enter Higgsfield Key / Token:
                      </span>
                      <a
                        href="https://higgsfield.ai"
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-0.5 underline transition"
                      >
                        <span>Get Key from Console</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>

                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => {
                        setApiKeyInput(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="KEY_ID:KEY_SECRET or Bearer token"
                      autoComplete="off"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/80 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-xs text-white placeholder-gray-500 font-mono outline-none transition"
                    />
                    <p className="text-[10px] text-gray-500">
                      Format: <code>KEY_ID:KEY_SECRET</code> (from Higgsfield Console)
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={connecting || !apiKeyInput.trim()}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-purple-950/60 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {connecting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Verifying with Higgsfield...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={14} />
                        <span>Authenticate Key</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

