import { ReactNode } from 'react';
import { Card } from 'antd';

interface LoginCardProps {
  children: ReactNode;
  embedded?: boolean;
}

/**
 * Login card container component
 */
export function LoginCard({ children, embedded = false }: LoginCardProps) {
  return (
    <div className={embedded ? 'login-shell login-shell-embedded' : 'login-shell'}>
      <Card
        className="login-panel"
        bordered={!embedded}
      >
        {children}
      </Card>
    </div>
  );
}
