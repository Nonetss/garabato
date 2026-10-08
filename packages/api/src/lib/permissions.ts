import { auth } from "@nonete/auth"
import type { AppAction, AppResource } from "@nonete/auth/permissions"

/** Check an application permission inside one explicit organization. */
export async function userHasOrganizationPermission<
  Resource extends AppResource,
>({
  organizationId,
  headers,
  resource,
  action,
}: {
  organizationId: string
  headers: Headers
  resource: Resource
  action: AppAction<Resource>
}) {
  const result = await auth.api.hasPermission({
    headers,
    body: {
      organizationId,
      permissions: { [resource]: [action] },
    },
  })

  return result.success
}
