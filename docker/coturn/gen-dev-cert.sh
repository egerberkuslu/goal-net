#!/bin/sh
# Self-signed certificate for the local TURN TLS listener (port 5349).
# Development only: browsers and turnutils will not trust it, which is fine
# because local dev never needs the turns: candidate to be publicly valid.
# Production uses real certificates, see docs/DEPLOY.md.
set -eu

DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)/certs
CN=${TURN_REALM:-goalnet.local}

mkdir -p "$DIR"
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout "$DIR/turn_server_pkey.pem" \
  -out "$DIR/turn_server_cert.pem" \
  -subj "/CN=$CN" \
  -addext "subjectAltName=DNS:$CN,IP:127.0.0.1"
# The coturn image runs as nobody (uid 65534), so a 0600 key owned by your
# user is unreadable inside the container and the TLS listener silently never
# comes up. This key is a throwaway that only ever signs localhost, so it is
# world readable on purpose. Production keys are handled differently, see
# docs/DEPLOY.md.
chmod 644 "$DIR/turn_server_pkey.pem" "$DIR/turn_server_cert.pem"

echo "wrote $DIR/turn_server_cert.pem and turn_server_pkey.pem (CN=$CN)"
echo "note: dev key is mode 644 so the coturn container (uid 65534) can read it"
