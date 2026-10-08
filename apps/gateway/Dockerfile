FROM caddy:2-alpine

COPY apps/gateway/Caddyfile /etc/caddy/Caddyfile

# 80: public HTTP entry point (the only port compose publishes)
EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
