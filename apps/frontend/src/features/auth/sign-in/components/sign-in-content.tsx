import { getIcon } from "@/lib/icon-registry"

const Loader2 = getIcon("status", "loading")
const Fingerprint = getIcon("auth", "sso")

import { AppLogo } from "@/components/shared/brand/app-logo"
import { Text, textVariants } from "@/components/shared/brand/typography"
import { FormField } from "@/components/shared/form/field-label"
import { AppLink } from "@/components/ui/app-link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Marker, MarkerContent } from "@/components/ui/marker"
import { useAuthConfig } from "@/features/auth/sign-in/hooks/use-auth-config"
import { useSignIn } from "@/features/auth/sign-in/hooks/use-sign-in"
import { cn } from "@/lib/utils"

const ERROR_ID = "sign-in-error"

export function SignInContent() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    submit,
    oidcLoading,
    signInWithOidc,
  } = useSignIn()
  const { data: authConfig } = useAuthConfig()

  const invalid = error ? true : undefined
  const describedBy = error ? ERROR_ID : undefined

  return (
    <Card className="dash-enter mx-auto w-full max-w-md gap-0 py-0">
      <CardHeader className="gap-4 border-b px-7 pt-8">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="dash-pop flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15"
          >
            <AppLogo alt="" size={26} />
          </span>
          <div className="space-y-1.5">
            <Text
              as="p"
              variant="label"
              tone="muted"
              className="font-mono"
              aria-hidden="true"
            >
              GARABATO · Acceso
            </Text>
            <CardTitle className="font-semibold text-lg tracking-tight">
              Iniciar sesión
            </CardTitle>
            <CardDescription className={textVariants({ role: "meta" })}>
              Introduce tu email para acceder a tu cuenta
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-7 py-7">
        <form onSubmit={submit} className="space-y-5">
          <FormField label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              disabled={loading}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              placeholder="tu@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <FormField label="Contraseña" htmlFor="password">
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={loading}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          {error ? (
            <Text
              as="p"
              variant="meta"
              tone="destructive"
              id={ERROR_ID}
              role="alert"
            >
              {error}
            </Text>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Entrando…
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>

        {authConfig?.ssoEnabled ? (
          <>
            <Marker
              variant="separator"
              className={cn(
                "my-4",
                textVariants({ role: "compact", tone: "muted" })
              )}
            >
              <MarkerContent>o</MarkerContent>
            </Marker>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={oidcLoading}
              onClick={signInWithOidc}
            >
              {oidcLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Conectando…
                </>
              ) : (
                <>
                  <Fingerprint className="size-4" aria-hidden="true" />
                  Continuar con SSO
                </>
              )}
            </Button>
          </>
        ) : null}
      </CardContent>

      <CardFooter className="border-t px-7 pb-7">
        <Text
          as="p"
          variant="compact"
          tone="muted"
          className="w-full text-center"
        >
          ¿No tienes cuenta?{" "}
          <AppLink
            href="/signup"
            className="font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:decoration-foreground"
          >
            Regístrate
          </AppLink>
        </Text>
      </CardFooter>
    </Card>
  )
}
