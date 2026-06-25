'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  href?: string;
}

export default function Button({ variant = 'primary', className = '', children, href, ...props }: ButtonProps) {
  const cls = `btn btn-${variant}${className ? ' ' + className : ''}`;
  if (href) {
    return (
      <a href={href} className={cls} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
