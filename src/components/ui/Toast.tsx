'use client';

interface ToastProps {
  message: string;
  isError?: boolean;
}

export default function Toast({ message, isError }: ToastProps) {
  return (
    <section className={`toast${isError ? ' error' : ''}`}>
      {message}
    </section>
  );
}
