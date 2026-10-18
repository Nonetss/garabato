/*
 * Minimal HTTPS client on NSS, the library Firefox (and Chromium on Linux)
 * use for client certificates. Runs the browser's client-auth path against a
 * local server without a browser: NSS picks the certificate, asks for the
 * token PIN through the password callback and signs through the module.
 *
 * Usage: nssclient <nssdb> <host> <port> <nickname|-> <pin> <connections>
 * With "-" NSS picks the certificate on its own, as a browser set to
 * choose automatically does.
 * The database must already have the module (modutil -add). The server
 * certificate is not verified: the test server is self-signed.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <nspr.h>
#include <nss.h>
#include <pk11pub.h>
#include <ssl.h>
#include <sslproto.h>

static const char *pin;
static int pin_requests;

static char *password(PK11SlotInfo *slot, PRBool retry, void *arg) {
  (void)arg;
  pin_requests++;
  printf("  NSS pide el PIN de \"%s\" (reintento=%d)\n", PK11_GetTokenName(slot),
         retry);
  /* A retry means the PIN was wrong: give up as a user cancelling would. */
  fflush(stdout);
  if (retry) return NULL;
  return PORT_Strdup(pin);
}

static SECStatus accept_server(void *arg, PRFileDesc *fd, PRBool sig,
                               PRBool server) {
  (void)arg; (void)fd; (void)sig; (void)server;
  return SECSuccess;
}

static const char *version_name(PRUint16 v) {
  switch (v) {
    case SSL_LIBRARY_VERSION_TLS_1_2: return "TLS 1.2";
    case SSL_LIBRARY_VERSION_TLS_1_3: return "TLS 1.3";
    default: return "otra";
  }
}

static int connect_once(const char *host, int port, char *nickname, int n) {
  PRNetAddr addr;
  PRAddrInfo *info = PR_GetAddrInfoByName(host, PR_AF_INET, PR_AI_ADDRCONFIG);
  if (!info || !PR_EnumerateAddrInfo(NULL, info, (PRUint16)port, &addr)) {
    fprintf(stderr, "No resuelve %s\n", host);
    return 1;
  }
  PR_FreeAddrInfo(info);

  PRFileDesc *tcp = PR_NewTCPSocket();
  PRFileDesc *fd = SSL_ImportFD(NULL, tcp);
  SSL_OptionSet(fd, SSL_SECURITY, PR_TRUE);
  SSL_OptionSet(fd, SSL_HANDSHAKE_AS_CLIENT, PR_TRUE);
  SSLVersionRange range = {SSL_LIBRARY_VERSION_TLS_1_2,
                           SSL_LIBRARY_VERSION_TLS_1_3};
  SSL_VersionRangeSet(fd, &range);
  SSL_SetURL(fd, host);
  SSL_AuthCertificateHook(fd, accept_server, NULL);
  SSL_GetClientAuthDataHook(fd, NSS_GetClientAuthData,
                            strcmp(nickname, "-") == 0 ? NULL : nickname);

  if (PR_Connect(fd, &addr, PR_SecondsToInterval(10)) != PR_SUCCESS) {
    fprintf(stderr, "No conecta: error %d\n", PR_GetError());
    PR_Close(fd);
    return 1;
  }
  char request[256];
  snprintf(request, sizeof request, "GET / HTTP/1.0\r\nHost: %s\r\n\r\n", host);
  if (PR_Write(fd, request, (PRInt32)strlen(request)) < 0) {
    fprintf(stderr, "Conexión %d: handshake fallido, error NSS %d (%s)\n", n,
            PR_GetError(), PR_ErrorToName(PR_GetError()));
    PR_Close(fd);
    return 1;
  }
  char buffer[4096];
  PRInt32 total = 0, read;
  int client_cert_seen = 0;
  while ((read = PR_Read(fd, buffer, sizeof buffer - 1)) > 0) {
    buffer[read] = 0;
    total += read;
    if (strstr(buffer, "Client certificate")) client_cert_seen = 1;
  }
  SSLChannelInfo channel;
  SSL_GetChannelInfo(fd, &channel, sizeof channel);
  printf("Conexión %d: %s, sesión %s, %d bytes, certificado cliente %s\n", n,
         version_name(channel.protocolVersion),
         channel.resumed ? "reanudada" : "nueva", total,
         client_cert_seen ? "aceptado por el servidor" : "NO visto");
  PR_Close(fd);
  return client_cert_seen ? 0 : 1;
}

int main(int argc, char **argv) {
  if (argc != 7) {
    fprintf(stderr,
            "Uso: %s <nssdb> <host> <puerto> <nickname> <pin> <conexiones>\n",
            argv[0]);
    return 2;
  }
  pin = argv[5];
  PK11_SetPasswordFunc(password);
  if (NSS_Init(argv[1]) != SECSuccess) {
    fprintf(stderr, "NSS_Init falló: %d\n", PR_GetError());
    return 1;
  }
  NSS_SetDomesticPolicy();

  int failures = 0;
  int connections = atoi(argv[6]);
  /* NSSCLIENT_PAUSE: seconds between connections, to let NSS's cached
   * login state expire as it would between page loads. */
  const char *pause = getenv("NSSCLIENT_PAUSE");
  for (int i = 1; i <= connections; i++) {
    if (i > 1 && pause) PR_Sleep(PR_SecondsToInterval(atoi(pause)));
    fflush(stdout);
    failures += connect_once(argv[2], atoi(argv[3]), argv[4], i);
  }

  printf("PIN pedido %d veces, %d conexiones fallidas\n", pin_requests,
         failures);
  SSL_ClearSessionCache();
  NSS_Shutdown();
  return failures == 0 ? 0 : 1;
}
