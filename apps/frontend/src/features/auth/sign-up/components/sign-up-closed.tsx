import { AppLogo } from "@/components/shared/brand/app-logo"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { AppLink } from "@/components/ui/app-link"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"

/** Shown on `/signup` when the server sets `DISABLE_SIGN_UP`. */
export function SignUpClosed() {
  return (
    <Card className="dash-enter mx-auto w-full max-w-md gap-0 py-0">
      <CardHeader className="items-center gap-4 border-b px-7 pt-8 text-center">
        <div className="flex w-full flex-col items-center gap-4">
          <span
            aria-hidden="true"
            className="dash-pop mx-auto flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15"
          >
            <AppLogo alt="" size={26} className="mx-auto" />
          </span>
          <div className="w-full space-y-1.5 text-center">
            <Text
              as="p"
              variant="label"
              tone="muted"
              className="font-mono"
              aria-hidden="true"
            >
              NONETE · Registro
            </Text>
            <Text as="h1" variant="display">
              Registro cerrado
            </Text>
            <CardDescription className={textVariants({ role: "meta" })}>
              No se pueden crear cuentas nuevas desde aquí. Pide a un
              administrador que te dé de alta.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardFooter className="border-t px-7 pb-7">
        <Text
          as="p"
          variant="compact"
          tone="muted"
          className="w-full text-center"
        >
          ¿Ya tienes cuenta?{" "}
          <AppLink
            href="/login"
            className="font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:decoration-foreground"
          >
            Inicia sesión
          </AppLink>
        </Text>
      </CardFooter>
    </Card>
  )
}
