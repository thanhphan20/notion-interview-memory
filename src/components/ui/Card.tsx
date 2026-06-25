'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = '' }: CardProps) {
  const cls = `item${className ? ' ' + className : ''}`;
  return <article className={cls}>{children}</article>;
}
