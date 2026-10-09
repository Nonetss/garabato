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
import { Spinner } from "@/components/ui/spinner"
import { useSignUp } from "@/features/auth/sign-up/hooks/use-sign-up"

const ERROR_ID = "sign-up-error"

export function SignUpForm() {
  const {
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    submit,
  } = useSignUp()

  const invalid = error ? true : undefined
  const describedBy = error ? ERROR_ID : undefined

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
            <CardTitle className="font-semibold text-lg tracking-tight">
              Crear cuenta
            </CardTitle>
            <CardDescription className={textVariants({ role: "meta" })}>
              Introduce tus datos para crear tu cuenta
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-7 py-7">
        <form onSubmit={submit} className="space-y-5">
          <FormField label="Nombre" htmlFor="name">
            <Input
              id="name"
              type="text"
              required
              autoComplete="name"
              disabled={loading}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              placeholder="Ada Lovelace"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

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

          <FormField
            label="Contraseña"
            htmlFor="password"
            hint="Mínimo 8 caracteres"
          >
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
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
                <Spinner decorative />
                Creando cuenta…
              </>
            ) : (
              "Crear cuenta"
            )}
          </Button>
        </form>
      </CardContent>

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
