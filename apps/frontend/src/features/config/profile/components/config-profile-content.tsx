import { StateCard } from "@/components/shared/feedback/state-card"
import { PageHero } from "@/components/shared/layout/page-hero"
import { getIcon } from "@/lib/icon-registry"

const UserCircle = getIcon("identity", "userCircle")

export function ConfigProfileContent() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHero surface="config-profile" />
      <StateCard
        icon={<UserCircle className="size-6" />}
        title="Contenido pendiente"
        description="Aquí vivirá la gestión de nombre, correo y contraseña."
      />
    </div>
  )
}
