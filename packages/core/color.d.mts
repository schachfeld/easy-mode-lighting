export function hexToHsv(hex: string): { h: number; s: number; v: number };
export function hsvToHex(h: number, s: number, v?: number): string;
export function whiteToHex(kelvin: number): string;
export function colorsClose(a: string, b: string): boolean;
export function kelvinClose(a: number, b: number): boolean;
export function colorName(hex: string): string;
export function whiteName(kelvin: number): string;
