import { useCallback, useMemo, useState } from "react";

/** Portado do `projeto-hackathon` (`shared/presentation/hooks/usePresentationNavigation.ts`) sem alterações. */
export interface PresentationNavigation {
  index: number;
  totalSlides: number;
  isFirst: boolean;
  isLast: boolean;
  goTo: (index: number) => void;
  next: () => void;
  previous: () => void;
}

export function usePresentationNavigation(totalSlides: number): PresentationNavigation {
  const [index, setIndex] = useState(0);

  const goTo = useCallback(
    (target: number) => {
      setIndex(Math.min(Math.max(target, 0), Math.max(totalSlides - 1, 0)));
    },
    [totalSlides],
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const previous = useCallback(() => goTo(index - 1), [goTo, index]);

  return useMemo(
    () => ({
      index,
      totalSlides,
      isFirst: index === 0,
      isLast: index === totalSlides - 1,
      goTo,
      next,
      previous,
    }),
    [index, totalSlides, goTo, next, previous],
  );
}
