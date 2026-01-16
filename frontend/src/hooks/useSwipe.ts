import React, { useEffect, useRef } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

/**
 * Хук для обробки swipe жестів на мобільних пристроях
 */
export function useSwipe(handlers: SwipeHandlers, threshold: number = 50) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);

  const minSwipeDistance = threshold;

  const onTouchStart = (e: TouchEvent) => {
    touchEndX.current = null;
    touchEndY.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const onTouchMove = (e: TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current || !touchStartY.current || !touchEndY.current) return;

    const distanceX = touchStartX.current - touchEndX.current;
    const distanceY = touchStartY.current - touchEndY.current;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    const isUpSwipe = distanceY > minSwipeDistance;
    const isDownSwipe = distanceY < -minSwipeDistance;

    // Перевіряємо, що це горизонтальний swipe (більше ніж вертикальний)
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (isLeftSwipe && handlers.onSwipeLeft) {
        handlers.onSwipeLeft();
      }
      if (isRightSwipe && handlers.onSwipeRight) {
        handlers.onSwipeRight();
      }
    } else {
      // Вертикальний swipe
      if (isUpSwipe && handlers.onSwipeUp) {
        handlers.onSwipeUp();
      }
      if (isDownSwipe && handlers.onSwipeDown) {
        handlers.onSwipeDown();
      }
    }
  };

  useEffect(() => {
    const element = document.body;
    
    element.addEventListener('touchstart', onTouchStart);
    element.addEventListener('touchmove', onTouchMove);
    element.addEventListener('touchend', onTouchEnd);

    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers.onSwipeLeft, handlers.onSwipeRight, handlers.onSwipeUp, handlers.onSwipeDown]);
}

