import { getRandomValues, randomUUID } from "expo-crypto";

// The shared core uses Web Crypto for scene ids and sign-in state. Expo
// already provides URL, URLSearchParams and a spec-compliant fetch.
const crypto = ((globalThis as any).crypto ??= {});
crypto.getRandomValues ??= getRandomValues;
crypto.randomUUID ??= randomUUID;
