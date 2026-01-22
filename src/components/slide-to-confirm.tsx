'use client';

import React from "react"

import { useState, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

interface SlideToConfirmProps {
  onConfirm: () => void;
  label: string;
  disabled?: boolean;
  variant?: 'default' | 'success' | 'danger';
}

export default function SlideToConfirm({ 
  onConfirm, 
  label, 
  disabled = false,
  variant = 'default'
}: SlideToConfirmProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [trackWidth, setTrackWidth] = useState(250);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const thumbWidth = 56;
  const threshold = 0.85;

  useEffect(() => {
    const update = () => {
      const track = trackRef.current;
      if (!track) return;
      setTrackWidth(Math.max(1, track.offsetWidth - thumbWidth));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const handleStart = (clientX: number) => {
    if (disabled || isComplete) return;
    setIsDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || disabled || isComplete) return;
    
    const track = trackRef.current;
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const maxPosition = trackWidth;
    const newPosition = Math.min(Math.max(0, clientX - rect.left - thumbWidth / 2), maxPosition);
    
    setPosition(newPosition);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const maxPosition = trackWidth;
    const progress = position / maxPosition;

    if (progress >= threshold) {
      setIsComplete(true);
      setPosition(maxPosition);
      setTimeout(() => {
        onConfirm();
        // Reset after callback
        setTimeout(() => {
          setIsComplete(false);
          setPosition(0);
        }, 300);
      }, 200);
    } else {
      setPosition(0);
    }
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position]);

  const progress = position / trackWidth;

  const variantStyles = {
    default: {
      track: 'bg-zinc-800',
      thumb: 'bg-gradient-to-r from-violet-500 to-purple-600',
      progress: 'bg-gradient-to-r from-violet-500/20 to-purple-600/20',
    },
    success: {
      track: 'bg-zinc-800',
      thumb: 'bg-gradient-to-r from-emerald-500 to-green-600',
      progress: 'bg-gradient-to-r from-emerald-500/20 to-green-600/20',
    },
    danger: {
      track: 'bg-zinc-800',
      thumb: 'bg-gradient-to-r from-red-500 to-rose-600',
      progress: 'bg-gradient-to-r from-red-500/20 to-rose-600/20',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      ref={trackRef}
      className={`relative h-14 rounded-full overflow-hidden w-full max-w-full ${styles.track} ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      {/* Progress fill */}
      <div
        className={`absolute inset-y-0 left-0 ${styles.progress} transition-all ${
          isDragging ? 'duration-0' : 'duration-300'
        }`}
        style={{ width: `${position + thumbWidth}px` }}
      />

      {/* Label */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ 
          opacity: 1 - progress * 1.5,
          transform: `translateX(${position * 0.2}px)`
        }}
      >
        <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium pl-12">
          <ChevronRight className="w-4 h-4 animate-pulse" />
          <ChevronRight className="w-4 h-4 animate-pulse delay-75 -ml-2" />
          <span>{label}</span>
        </div>
      </div>

      {/* Draggable thumb */}
      <div
        ref={thumbRef}
        className={`absolute top-1 bottom-1 w-12 rounded-full ${styles.thumb} flex items-center justify-center shadow-lg ${
          isDragging ? 'scale-105' : ''
        } transition-transform ${isDragging ? 'duration-0' : 'duration-300 ease-out'}`}
        style={{ 
          left: `${position + 4}px`,
          transition: isDragging ? 'none' : 'left 0.3s ease-out, transform 0.1s'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <ChevronRight className="w-5 h-5 text-white" />
      </div>
    </div>
  );
}
