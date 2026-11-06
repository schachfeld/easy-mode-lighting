import { createContext, useContext } from "react";

// While a finger holds a slider or the color wheel, the page around it stops
// scrolling and the screen stops swiping back, so the drag only moves the
// control. Pages and sheets provide this; controls report when they are held.
export const HoldContext = createContext<(held: boolean) => void>(() => {});

export const useHold = () => useContext(HoldContext);
