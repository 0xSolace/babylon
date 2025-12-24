export {}

declare global {
  interface Window {
    __oauth3AccessToken?: string | null
    __oauth3GetAccessToken?: () => Promise<string | null>
  }
}

// styled-jsx types for Next.js
declare module 'react' {
  interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
    jsx?: boolean
    global?: boolean
  }
}
