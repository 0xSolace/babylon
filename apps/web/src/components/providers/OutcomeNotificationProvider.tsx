'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type OutcomeNotification,
  OutcomeNotificationPopup,
} from '@/components/notifications/OutcomeNotificationPopup';
import { StackedSummaryPopup } from '@/components/notifications/StackedSummaryPopup';

interface OutcomeNotificationContextValue {
  /** Show a single win/loss outcome notification pop-up */
  showOutcome: (notification: Omit<OutcomeNotification, 'id'>) => void;
  /** Show a stacked summary for multiple outcomes (e.g. user was away) */
  showBatchOutcomes: (notifications: Omit<OutcomeNotification, 'id'>[]) => void;
}

const OutcomeNotificationContext =
  createContext<OutcomeNotificationContextValue | null>(null);

/** Access outcome notification actions. Throws if used outside OutcomeNotificationProvider. */
export function useOutcomeNotification(): OutcomeNotificationContextValue {
  const ctx = useContext(OutcomeNotificationContext);
  if (!ctx)
    throw new Error(
      'useOutcomeNotification requires OutcomeNotificationProvider'
    );
  return ctx;
}

function makeId(): string {
  return `outcome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Provides win/loss outcome notification pop-ups.
 *
 * - Single notification: shows the full win/loss pop-up
 * - Multiple notifications at once (batch): shows a stacked summary
 *   ("3 markets resolved while you were away")
 *
 * Queues single notifications and displays them one at a time.
 * Each auto-dismisses after ~5 seconds or on user tap.
 */
export function OutcomeNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Single notification state
  const [current, setCurrent] = useState<OutcomeNotification | null>(null);
  const queueRef = useRef<OutcomeNotification[]>([]);
  const showingRef = useRef(false);

  // Batch/stacked summary state
  const [batchNotifications, setBatchNotifications] = useState<
    OutcomeNotification[]
  >([]);

  const showOutcome = useCallback(
    (notification: Omit<OutcomeNotification, 'id'>) => {
      const full: OutcomeNotification = { ...notification, id: makeId() };

      if (showingRef.current) {
        queueRef.current.push(full);
      } else {
        showingRef.current = true;
        setCurrent(full);
      }
    },
    []
  );

  const showBatchOutcomes = useCallback(
    (notifications: Omit<OutcomeNotification, 'id'>[]) => {
      if (notifications.length === 0) return;

      if (notifications.length === 1) {
        showOutcome(notifications[0]!);
        return;
      }

      const full = notifications.map((n) => ({ ...n, id: makeId() }));
      setBatchNotifications(full);
    },
    [showOutcome]
  );

  const handleDismiss = useCallback(() => {
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      if (!next) return;
      setCurrent(next);
    } else {
      showingRef.current = false;
      setCurrent(null);
    }
  }, []);

  const handleBatchDismiss = useCallback(() => {
    setBatchNotifications([]);
  }, []);

  const handleBatchViewResult = useCallback(
    (_notification: OutcomeNotification) => {
      setBatchNotifications([]);
    },
    []
  );

  const value = useMemo(
    () => ({ showOutcome, showBatchOutcomes }),
    [showOutcome, showBatchOutcomes]
  );

  return (
    <OutcomeNotificationContext.Provider value={value}>
      {children}
      <OutcomeNotificationPopup
        notification={current}
        onDismiss={handleDismiss}
      />
      <StackedSummaryPopup
        notifications={batchNotifications}
        onDismiss={handleBatchDismiss}
        onViewResult={handleBatchViewResult}
      />
    </OutcomeNotificationContext.Provider>
  );
}
