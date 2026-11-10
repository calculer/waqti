import React, { useState } from 'react';
import { Download, WifiOff } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';
import { useTranslation } from '../hooks/useTranslation';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { t } = useTranslation();

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent-primary)] transition hover:opacity-90 whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        <span>{t('common.installApp')}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:opacity-90 whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{t('common.installApp')}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xl">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {t('common.installApp')} (iOS)
              </h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                1. Safari Share &rarr; 2. Add to Home Screen
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-[var(--accent-primary)] py-2.5 text-xs font-semibold text-white"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { t } = useTranslation();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 start-4 z-50 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/95 px-3.5 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-md">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>{t('common.offlineMode')}</span>
    </div>
  );
};
