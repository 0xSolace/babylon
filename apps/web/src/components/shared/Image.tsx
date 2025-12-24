/**
 * Image component
 *
 * Standard img element wrapper that provides consistent defaults.
 * Framework-agnostic - works with any React/Preact setup.
 */

import { forwardRef, type ImgHTMLAttributes } from 'react'

export interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  alt?: string
  src: string
  width?: number | string
  height?: number | string
  fill?: boolean // Makes image fill container
  priority?: boolean // Preload hint
  // Next.js compatibility props (no-op in standard img)
  quality?: number
  unoptimized?: boolean
  sizes?: string
}

/**
 * Image component with sensible defaults
 */
const Image = forwardRef<HTMLImageElement, ImageProps>(
  (
    {
      alt = '',
      fill,
      priority,
      quality: _quality, // Next.js compat (ignored)
      unoptimized: _unoptimized, // Next.js compat (ignored)
      sizes: _sizes, // Next.js compat (ignored)
      style,
      className,
      ...props
    },
    ref,
  ) => {
    const fillStyles = fill
      ? {
          position: 'absolute' as const,
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover' as const,
        }
      : {}

    return (
      <img
        ref={ref}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        style={{ ...fillStyles, ...style }}
        className={className}
        {...props}
      />
    )
  },
)

Image.displayName = 'Image'

export default Image
