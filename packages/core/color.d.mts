import type { Light } from "./types";
export function hexToRgb(hex: string): [number, number, number];
export function rgbToHex(rgb: number[]): string;
export function rgbToHsv(rgb: number[]): { h: number; s: number; v: number };
export function hexToHsv(hex: string): { h: number; s: number; v: number };
export function hsvToHex(h: number, s: number, v?: number): string;
export function mixColors(a: string, b: string, amount: number): string;
export function kelvinToHex(kelvin: number): string;
export function whiteToHex(kelvin: number): string;
export function displayColor(
  light: Pick<Light, "color" | "kelvin" | "colorMode"> &
    Partial<Pick<Light, "colorSupported" | "temperatureSupported">>,
): string;
export function colorsClose(a: string, b: string): boolean;
export function colorName(hex: string): string;
export function whiteName(kelvin: number): string;
