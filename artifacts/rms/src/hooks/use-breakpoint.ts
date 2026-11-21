import * as React from "react";

export type BreakpointName = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const QUERIES: Record<BreakpointName, string> = {
  xs: "(max-width: 639px)",
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
  "2xl": "(min-width: 1536px)",
};

function getSnapshot() {
  if (typeof window === "undefined") {
    return {
      width: 1280,
      height: 800,
      isPortrait: false,
      isCompactPos: false,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isPortrait =
    height > width ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(orientation: portrait)").matches);

  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  // CSS px shrink under Windows display scaling (e.g. 1080×1920 @150% ≈ 720×1280).
  // Treat tall/wide computer & kiosk viewports as expansive dual-pane POS.
  const isExpansivePos =
    width >= 900 ||
    (isPortrait && shortSide >= 640 && longSide >= 1100) ||
    (!isPortrait && width >= 1000 && height >= 560);
  const isCompactPos = !isExpansivePos;

  return {
    width,
    height,
    isPortrait,
    isCompactPos,
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1200,
    isDesktop: !isCompactPos,
  };
}

export function useBreakpoint() {
  const [state, setState] = React.useState(getSnapshot);

  React.useEffect(() => {
    const update = () => setState(getSnapshot());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const portraitMq = window.matchMedia("(orientation: portrait)");
    portraitMq.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      portraitMq.removeEventListener?.("change", update);
    };
  }, []);

  return state;
}

/** @deprecated prefer useBreakpoint().isMobile */
export function useIsMobile() {
  return useBreakpoint().isMobile;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export const BREAKPOINT_QUERIES = QUERIES;
