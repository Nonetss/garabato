import { PageHero } from "@/components/shared/layout/page-hero"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ThemeModeSelector } from "@/features/config/appearance/components/theme-mode-selector"

export function ConfigAppearanceContent() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHero surface="config-appearance" />
      <Card>
        <CardHeader>
          <CardTitle>Tema</CardTitle>
          <CardDescription>
            Elige cómo quieres que se vea la aplicación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeModeSelector />
        </CardContent>
      </Card>
    </div>
  )
}
