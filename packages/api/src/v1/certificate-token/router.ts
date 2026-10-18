import { openapi } from "@orpc/openapi"
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  tokenProcedure,
} from "#index"
import { certificateTokenHandler } from "#v1/certificate-token/handler"
import { certificateTokenInput } from "#v1/certificate-token/input"
import { certificateTokenOutput } from "#v1/certificate-token/output"

const TAGS = ["Browser certificate token"]

export const certificateTokenRouter = {
  startConnection: protectedProcedure
    .meta(
      openapi({
        summary: "Connect a browser",
        description:
          "Starts a connection for a browser name: answers a one-time install code (10 minutes) and the command that installs the module with it. The token key is created only when the install script redeems the code. Requires two-factor authentication (CONFLICT otherwise).",
        tags: TAGS,
        method: "POST",
        successStatus: 201,
      })
    )
    .input(certificateTokenInput.startConnection)
    .output(certificateTokenOutput.startConnection)
    .handler(({ context, input }) =>
      certificateTokenHandler.startConnection({ context, input })
    ),

  connectionStatus: protectedProcedure
    .meta(
      openapi({
        summary: "State of a browser connection",
        description:
          "Pending until the install script redeems the code, then connected with the new token key's id; expired after 10 minutes unused. Another user's or an unknown code answers NOT_FOUND.",
        tags: TAGS,
        method: "GET",
      })
    )
    .input(certificateTokenInput.connectionStatus)
    .output(certificateTokenOutput.connectionStatus)
    .handler(({ context, input }) =>
      certificateTokenHandler.connectionStatus({ context, input })
    ),

  redeem: publicProcedure
    .meta(
      openapi({
        summary: "Redeem an install code",
        description:
          "Called by the install script; the one-time code is the credential. Creates the token key for the user who started the connection and answers Garabato's address, the key and the SHA-256 of the module for the architecture. A used, expired or unknown code, or an architecture this installation does not ship, answers NOT_FOUND and creates nothing.",
        tags: TAGS,
        method: "POST",
      })
    )
    .input(certificateTokenInput.redeem)
    .output(certificateTokenOutput.redeem)
    .handler(({ input }) => certificateTokenHandler.redeem({ input })),

  installScript: publicProcedure
    .meta(
      openapi({
        summary: "Install script",
        description:
          "The POSIX shell script that installs the browser module, with Garabato's address and the code built in. For a code that is not pending it answers a script that only prints that the command expired.",
        tags: TAGS,
        method: "GET",
      })
    )
    .input(certificateTokenInput.installScript)
    .output(certificateTokenOutput.installScript)
    .handler(({ input }) => certificateTokenHandler.installScript({ input })),

  module: publicProcedure
    .meta(
      openapi({
        summary: "Download the browser module",
        description:
          "The prebuilt PKCS#11 module for x86_64 or aarch64 Linux. Any other architecture, or one this installation does not ship, answers NOT_FOUND.",
        tags: TAGS,
        method: "GET",
      })
    )
    .input(certificateTokenInput.module)
    .output(certificateTokenOutput.module)
    .handler(({ input }) => certificateTokenHandler.module({ input })),

  switches: protectedProcedure
    .meta(
      openapi({
        summary: "Browser token switches",
        description:
          "Whether the browser token and new installs are enabled, the minimum module version and the version the installers hand out, for the certificates page.",
        tags: TAGS,
        method: "GET",
      })
    )
    .output(certificateTokenOutput.switches)
    .handler(() => certificateTokenHandler.switches()),

  settings: adminProcedure
    .meta(
      openapi({
        summary: "Browser token settings",
        description:
          "Admin only. The emergency switches, who changed them last and when, and the connected browsers of every user grouped by module version and platform.",
        tags: TAGS,
        method: "GET",
      })
    )
    .output(certificateTokenOutput.settings)
    .handler(() => certificateTokenHandler.settings()),

  updateSettings: adminProcedure
    .meta(
      openapi({
        summary: "Change the browser token settings",
        description:
          "Admin only. Replaces the emergency switches; they apply from the next request. Logged with the administrator and the old and new values.",
        tags: TAGS,
        method: "PUT",
      })
    )
    .input(certificateTokenInput.updateSettings)
    .output(certificateTokenOutput.updateSettings)
    .handler(({ context, input }) =>
      certificateTokenHandler.updateSettings({ context, input })
    ),

  listKeys: protectedProcedure
    .meta(
      openapi({
        summary: "List connected browsers",
        description:
          "Returns the caller's token keys, newest first, without their values.",
        tags: TAGS,
        method: "GET",
      })
    )
    .output(certificateTokenOutput.listKeys)
    .handler(({ context }) => certificateTokenHandler.listKeys({ context })),

  revokeKey: protectedProcedure
    .meta(
      openapi({
        summary: "Disconnect a browser",
        description:
          "Revokes one of the caller's token keys and closes its signing window. Another user's or an unknown key answers NOT_FOUND.",
        tags: TAGS,
        method: "DELETE",
      })
    )
    .input(certificateTokenInput.revokeKey)
    .output(certificateTokenOutput.revokeKey)
    .handler(({ context, input }) =>
      certificateTokenHandler.revokeKey({ context, input })
    ),

  certificates: tokenProcedure
    .meta(
      openapi({
        summary: "Certificates offered through the token",
        description:
          "Token key only. The key owner's certificates that are not deleted, valid now, with a remembered password and an RSA key, with their DER. Needs no open signing window.",
        tags: TAGS,
        method: "GET",
      })
    )
    .output(certificateTokenOutput.certificates)
    .handler(({ context }) =>
      certificateTokenHandler.certificates({ context })
    ),

  unlock: tokenProcedure
    .meta(
      openapi({
        summary: "Unlock the token with a TOTP code",
        description:
          "Token key only. A valid authenticator code (not a backup code, not one already used) opens the key's signing window for 15 minutes. A wrong code answers BAD_REQUEST; after 5 within 15 minutes, TOO_MANY_REQUESTS for 15 minutes.",
        tags: TAGS,
        method: "POST",
      })
    )
    .input(certificateTokenInput.unlock)
    .output(certificateTokenOutput.unlock)
    .handler(({ context, input }) =>
      certificateTokenHandler.unlock({ context, input })
    ),

  lock: tokenProcedure
    .meta(
      openapi({
        summary: "Lock the token",
        description:
          "Token key only. Closes the key's signing window at once. Idempotent.",
        tags: TAGS,
        method: "POST",
      })
    )
    .output(certificateTokenOutput.lock)
    .handler(({ context }) => certificateTokenHandler.lock({ context })),

  sign: tokenProcedure
    .meta(
      openapi({
        summary: "Sign for the token",
        description:
          "Token key only. Signs a TLS client-authentication DigestInfo (rsa-pkcs1) or hash (rsa-pss) with a certificate offered through the token, and traces it. A closed window answers FORBIDDEN, a certificate not offered NOT_FOUND, data that does not fit the mechanism BAD_REQUEST.",
        tags: TAGS,
        method: "POST",
      })
    )
    .input(certificateTokenInput.sign)
    .output(certificateTokenOutput.sign)
    .handler(({ context, input }) =>
      certificateTokenHandler.sign({ context, input })
    ),
}
