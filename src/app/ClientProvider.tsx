'use client';

import React from 'react';
import { ToastProvider } from '@/components/ToastProvider';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}