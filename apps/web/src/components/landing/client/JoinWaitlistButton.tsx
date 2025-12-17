'use client';

import { useJejuAuth } from '@babylon/auth/client';

interface JoinWaitlistButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function JoinWaitlistButton({
  className,
  children,
}: JoinWaitlistButtonProps) {
  const { loginWithWallet } = useJejuAuth();

  const handleClick = () => {
    loginWithWallet();
  };

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
