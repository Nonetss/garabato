import { cn } from "@/lib/utils"

export interface AppLogoProps {
  alt: string
  className?: string
  size?: number
  src?: string
}

/** Application mark, independent from navigation, session and page state. */
export function AppLogo({
  alt,
  className,
  size = 32,
  src = "/logo.webp",
}: AppLogoProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("shrink-0", className)}
    />
  )
}
