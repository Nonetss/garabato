import type { ReactNode } from "react"
import {
  AvatarFallback,
  AvatarImage,
  Avatar as AvatarPrimitive,
} from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type AvatarSize = "xs" | "sm" | "md" | "lg"

const SIZE_TO_DATA: Record<AvatarSize, "sm" | "default" | "lg"> = {
  xs: "sm",
  sm: "sm",
  md: "default",
  lg: "lg",
}

const SIZE_TO_REM: Record<AvatarSize, string> = {
  xs: "size-6",
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
}

const SIZE_TO_TEXT: Record<AvatarSize, string> = {
  xs: "text-xs",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
}

/**
 * Five muted-neutral slots picked deterministically from the seed, so each
 * user renders a stable, distinguishable fill without inventing a new color
 * (the One Accent Rule reserves Brand Terracotta for hero icon / primary
 * CTA / alive-state dot — avatars stay in the monochrome ramp).
 */
const PALETTE: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: "bg-muted text-foreground", fg: "text-foreground" },
  { bg: "bg-card text-card-foreground", fg: "text-card-foreground" },
  {
    bg: "bg-secondary text-secondary-foreground",
    fg: "text-secondary-foreground",
  },
  { bg: "bg-accent text-accent-foreground", fg: "text-accent-foreground" },
  { bg: "bg-border text-foreground", fg: "text-foreground" },
]

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function slotFor(seed: string): (typeof PALETTE)[number] {
  return PALETTE[hashSeed(seed) % PALETTE.length]
}

function initialsFor(seed: string, max = 2): string {
  const trimmed = seed.trim()
  if (!trimmed) return "?"
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const letters = parts
    .slice(0, max)
    .map((part) => part[0] ?? "")
    .join("")
  return letters.toUpperCase() || "?"
}

export interface UserAvatarProps {
  displayName: string | null | undefined
  email?: string | null
  imageUrl?: string | null
  size?: AvatarSize
  className?: string
  /** Optional content rendered as the Radix fallback (defaults to initials). */
  fallback?: ReactNode
}

/**
 * System avatar with deterministic muted fill and 1-2 character initials.
 * Wraps the Radix primitive in `components/ui/avatar.tsx`. Used by
 * `ProfilePage` and `UserNav`; migrate other ad-hoc avatar tiles here.
 */
export function UserAvatar({
  displayName,
  email,
  imageUrl,
  size = "md",
  className,
  fallback,
}: UserAvatarProps) {
  const seed = (displayName?.trim() || email?.trim() || "anon").toLowerCase()
  const initials = initialsFor(seed)
  const slot = slotFor(seed)

  return (
    <AvatarPrimitive
      size={SIZE_TO_DATA[size]}
      className={cn(SIZE_TO_REM[size], className)}
      aria-label={displayName ?? email ?? "Avatar"}
    >
      {imageUrl ? (
        <AvatarImage src={imageUrl} alt={displayName ?? email ?? ""} />
      ) : null}
      <AvatarFallback
        className={cn(
          "font-medium tracking-tight",
          slot.bg,
          SIZE_TO_TEXT[size]
        )}
      >
        {fallback ?? initials}
      </AvatarFallback>
    </AvatarPrimitive>
  )
}
