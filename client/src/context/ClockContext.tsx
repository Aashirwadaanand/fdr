import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

interface ClockStatus {
  currentDate: string;
  isAdvanced: boolean;
  offsetDays: number;
}

interface ClockContextType {
  clockStatus: ClockStatus;
  refreshClock: () => Promise<void>;
  advanceDays: (days: number) => Promise<any>;
  setFixedDate: (date: string) => Promise<any>;
  resetClock: () => Promise<any>;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

const ClockContext = createContext<ClockContextType | undefined>(undefined);

export const ClockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [clockStatus, setClockStatus] = useState<ClockStatus>({
    currentDate: '2026-10-27',
    isAdvanced: false,
    offsetDays: 0,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const refreshClock = async () => {
    if (!user) return;
    try {
      const status = await api.getClock();
      setClockStatus(status);
    } catch {
      // ignore if unauthenticated
    }
  };

  useEffect(() => {
    refreshClock();
  }, [user]);

  const advanceDays = async (days: number) => {
    const res = await api.advanceClock(days);
    setClockStatus(res.status);
    return res;
  };

  const setFixedDate = async (date: string) => {
    const res = await api.setClockDate(date);
    setClockStatus(res.status);
    return res;
  };

  const resetClock = async () => {
    const res = await api.resetClock();
    setClockStatus(res.status);
    return res;
  };

  return (
    <ClockContext.Provider
      value={{
        clockStatus,
        refreshClock,
        advanceDays,
        setFixedDate,
        resetClock,
        isModalOpen,
        setIsModalOpen,
      }}
    >
      {children}
    </ClockContext.Provider>
  );
};

export const useClock = () => {
  const context = useContext(ClockContext);
  if (!context) throw new Error('useClock must be used within ClockProvider');
  return context;
};
