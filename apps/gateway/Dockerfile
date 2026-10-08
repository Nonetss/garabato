FROM caddy:2-alpine

# Caddyfile is the production config; Caddyfile.dev is only run by the dev
# compose files. Both import routes.caddy.
COPY apps/gateway/Caddyfile apps/gateway/Caddyfile.dev apps/gateway/routes.caddy /etc/caddy/

# 80: public HTTP entry point (the only port compose publishes)
EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
