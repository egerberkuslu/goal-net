#!/bin/sh
# Builds coturn's command line from the environment so that turnserver.conf
# can stay in git without carrying a secret, a realm or a public IP.
set -eu

CONF=${TURN_CONF:-/etc/coturn/turnserver.conf}
CERT=/etc/coturn/certs/turn_server_cert.pem
PKEY=/etc/coturn/certs/turn_server_pkey.pem

if [ -z "${TURN_SECRET:-}" ]; then
  echo "coturn: TURN_SECRET is empty. Refusing to start, because the only" >&2
  echo "        alternative coturn would accept is an open relay." >&2
  echo "        Generate one with: openssl rand -hex 32" >&2
  exit 1
fi

set -- -c "$CONF" \
  --realm="${TURN_REALM:-goalnet.local}" \
  --static-auth-secret="$TURN_SECRET"

# Local dev binds loopback only; production binds the public interface and
# additionally declares the address peers see (--external-ip) when behind NAT.
LISTEN=${TURN_LISTENING_IP:-127.0.0.1}
set -- "$@" --listening-ip="$LISTEN" --relay-ip="${TURN_RELAY_IP:-$LISTEN}"

if [ -n "${TURN_EXTERNAL_IP:-}" ]; then
  set -- "$@" --external-ip="$TURN_EXTERNAL_IP"
fi

if [ -n "${TURN_MIN_PORT:-}" ]; then set -- "$@" --min-port="$TURN_MIN_PORT"; fi
if [ -n "${TURN_MAX_PORT:-}" ]; then set -- "$@" --max-port="$TURN_MAX_PORT"; fi
if [ -n "${TURN_TOTAL_QUOTA:-}" ]; then set -- "$@" --total-quota="$TURN_TOTAL_QUOTA"; fi

if [ -r "$CERT" ] && [ -r "$PKEY" ]; then
  echo "coturn: TLS listener on 5349 using $CERT"
else
  echo "coturn: WARNING no certificate at $CERT, starting without TLS." >&2
  echo "        Local dev only. Run docker/coturn/gen-dev-cert.sh, or mount" >&2
  echo "        real certificates, before exposing this to the internet." >&2
  set -- "$@" --no-tls --no-dtls
fi

if [ -n "${TURN_EXTRA_ARGS:-}" ]; then
  # shellcheck disable=SC2086
  set -- "$@" $TURN_EXTRA_ARGS
fi

echo "coturn: exec turnserver $*" | sed "s/--static-auth-secret=[^ ]*/--static-auth-secret=***/"
exec turnserver "$@"
