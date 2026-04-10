type PrivyLoginMethod = string;

type PrivyClientConfig = {
  appearance?: {
    theme?: string;
    accentColor?: string;
    logo?: string;
    walletChainType?: string;
    [key: string]: unknown;
  };
  loginMethodsAndOrder?: {
    primary?: PrivyLoginMethod[];
    overflow?: PrivyLoginMethod[];
  };
  [key: string]: unknown;
};

type Appearance = Omit<
  NonNullable<PrivyClientConfig['appearance']>,
  'theme'
> & {
  theme?: 'light' | 'dark' | `#${string}` | 'system';
};

type BabylonPrivyConfig = Omit<PrivyClientConfig, 'appearance'> & {
  appearance?: Appearance;
};

const appearance: Appearance = {
  theme: 'system',
  accentColor: '#0066FF',
  logo: '/assets/logos/logo.svg',
  walletChainType: 'ethereum-only',
};

export const loginMethodsAndOrder: NonNullable<
  BabylonPrivyConfig['loginMethodsAndOrder']
> = {
  primary: ['twitter', 'farcaster', 'email'],
  overflow: ['telegram', 'discord'],
};

export const privyConfig: { appId: string; config: BabylonPrivyConfig } = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
  config: {
    appearance,
    loginMethodsAndOrder,
  },
};
