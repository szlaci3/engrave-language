import { useCallback, useEffect, useRef, useState } from 'react';

/** A nonblocking notice that dismisses itself while practice continues. */
export function usePracticeCompletion() {
  const [notice, setNotice] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const round = useRef(0);
  const complete = useCallback(() => {
    clearTimeout(timer.current);
    setNotice(++round.current);
    timer.current = setTimeout(() => setNotice(0), 5000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { notice, complete };
}
