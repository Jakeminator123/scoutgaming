'use client';

import { createContext } from 'react';

export interface NativeSpeechBinding { source: Window; origin: string; channel: string; revision: number }
// A trusted window reference is intentionally kept in memory, never serialized
// into saved projects, provider requests or the observation export.
export const NativeSpeechContext = createContext<{ binding: NativeSpeechBinding | null; connected: boolean }>({ binding: null, connected: false });
