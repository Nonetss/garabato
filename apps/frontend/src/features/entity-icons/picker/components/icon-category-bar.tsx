import { buttonVariants } from "@/components/ui/button"
import type { IconCategoryId } from "@/features/entity-icons/picker/model/icon-categories.generated"
import { cn } from "@/lib/utils"

interface IconCategoryBarProps {
  categories: { id: IconCategoryId; title: string }[]
  active: IconCategoryId | null
  onChange: (category: IconCategoryId | null) => void
}

export function IconCategoryBar({
  categories,
  active,
  onChange,
}: IconCategoryBarProps) {
  const chip = (isActive: boolean) =>
    cn(
      buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "xs" }),
      "shrink-0",
      !isActive && "text-muted-foreground"
    )

  return (
    <div
      role="toolbar"
      aria-label="Categorías"
      className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]"
    >
      <button
        type="button"
        aria-pressed={active === null}
        className={chip(active === null)}
        onClick={() => onChange(null)}
      >
        Todas
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          aria-pressed={active === category.id}
          className={chip(active === category.id)}
          onClick={() => onChange(category.id)}
        >
          {category.title}
        </button>
      ))}
    </div>
  )
}
