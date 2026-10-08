import { Text } from "@/components/shared/brand/typography"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  describePermissions,
  roleOptions,
} from "@/features/admin/organizations/definitions/role-options"
import type { OrganizationCustomRole } from "@/features/admin/organizations/model/types"

interface RoleSelectProps {
  id?: string
  value: string
  onValueChange: (role: string) => void
  customRoles?: OrganizationCustomRole[]
  size?: "default" | "sm"
  className?: string
  showDescription?: boolean
}

export function RoleSelect({
  id,
  value,
  onValueChange,
  customRoles = [],
  size = "default",
  className,
  showDescription = false,
}: RoleSelectProps) {
  const options = [
    ...roleOptions,
    ...customRoles.map((customRole) => ({
      value: customRole.role,
      label: customRole.role,
      description: describePermissions(customRole.permission),
    })),
  ]
  const selected = options.find((option) => option.value === value)

  const select = (
    <Select
      items={options}
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue !== null) onValueChange(nextValue)
      }}
    >
      <SelectTrigger
        id={id}
        size={size}
        className={className}
        title={selected?.description}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            title={option.description}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (!showDescription) return select

  return (
    <div className="space-y-1.5">
      {select}
      {selected ? (
        <Text as="p" variant="compact" tone="muted">
          {selected.description}
        </Text>
      ) : null}
    </div>
  )
}
