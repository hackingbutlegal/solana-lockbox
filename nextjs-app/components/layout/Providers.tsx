/**
 * Client-side Providers Wrapper
 *
 * Wraps the app with Toast and Confirm dialog providers
 */

'use client';

import React from 'react';
import { ToastProvider } from '../ui/Toast';
import { ConfirmProvider } from '../ui/ConfirmDialog';

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {children}
      </ConfirmProvider>
    </ToastProvider>
  );
};
