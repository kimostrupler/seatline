'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_SEAT_SIZE, type SeatSize } from '@/lib/map-geometry';

/** The current floor's desk size, for the shapes drawn inside the canvas. */
export const SeatSizeContext = createContext<SeatSize>(DEFAULT_SEAT_SIZE);
export const useSeatSize = () => useContext(SeatSizeContext);
