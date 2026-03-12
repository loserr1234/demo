#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# tunnel.sh — Start cloudflared quick tunnel, then auto-update:
#   • backend/.env        (BACKEND_URL)
#   • Razorpay webhook    (via dashboard API — prints URL if API call fails)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
ENV_FILE="$ROOT/.env"
FRONTEND_ENV="$ROOT/../frontend/.env"
LOG="/tmp/cloudflared-tunnel.log"

RZP_KEY_ID=$(grep RAZORPAY_KEY_ID     "$ENV_FILE" | cut -d= -f2 | tr -d '"')
RZP_KEY_SECRET=$(grep RAZORPAY_KEY_SECRET "$ENV_FILE" | cut -d= -f2 | tr -d '"')
WEBHOOK_ID="SOkKloNCUeHjdr"

# ── 1. Kill any existing cloudflared quick-tunnel ────────────────────────────
echo "──────────────────────────────────────────"
echo " School ERP — Tunnel Manager"
echo "──────────────────────────────────────────"
echo ""
echo "→ Stopping any existing cloudflared tunnel..."
pkill -f "cloudflared tunnel --url" 2>/dev/null || true
sleep 1

# ── 2. Start new tunnel ──────────────────────────────────────────────────────
echo "→ Starting cloudflared tunnel → http://localhost:5001 ..."
rm -f "$LOG"
cloudflared tunnel --url http://localhost:5001 --logfile "$LOG" > /dev/null 2>&1 &
TUNNEL_PID=$!
echo "  PID: $TUNNEL_PID"

# ── 3. Wait for URL (up to 20s) ──────────────────────────────────────────────
echo "→ Waiting for tunnel URL..."
TUNNEL_URL=""
for i in $(seq 1 20); do
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1 || true)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "✗ Failed to get tunnel URL after 20s. Check $LOG"
  exit 1
fi

echo ""
echo "  ✓ Tunnel URL: $TUNNEL_URL"
echo ""

# ── 4. Update backend/.env and frontend/.env ─────────────────────────────────
echo "→ Updating backend/.env ..."
sed -i.bak "s|BACKEND_URL=.*|BACKEND_URL=\"$TUNNEL_URL\"|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
echo "  ✓ BACKEND_URL set to $TUNNEL_URL"

echo "→ Updating frontend/.env ..."
if [ -f "$FRONTEND_ENV" ]; then
  sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=$TUNNEL_URL|" "$FRONTEND_ENV" && rm -f "${FRONTEND_ENV}.bak"
  echo "  ✓ VITE_API_URL set to $TUNNEL_URL"
else
  echo "VITE_API_URL=$TUNNEL_URL" > "$FRONTEND_ENV"
  echo "  ✓ Created frontend/.env with VITE_API_URL=$TUNNEL_URL"
fi

# ── 5. Update Razorpay webhook ───────────────────────────────────────────────
echo ""
echo "→ Updating Razorpay webhook ($WEBHOOK_ID) ..."
WEBHOOK_URL="${TUNNEL_URL}/api/webhooks/razorpay"

RZP_RESPONSE=$(curl -s -o /tmp/rzp_response.json -w "%{http_code}" \
  -X PATCH \
  -u "${RZP_KEY_ID}:${RZP_KEY_SECRET}" \
  "https://api.razorpay.com/v1/webhooks/${WEBHOOK_ID}" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\"}" 2>/dev/null || echo "000")

if [ "$RZP_RESPONSE" = "200" ]; then
  echo "  ✓ Razorpay webhook updated to $WEBHOOK_URL"
else
  echo "  ⚠ Razorpay API returned HTTP $RZP_RESPONSE (webhook management requires dashboard for merchant keys)"
  echo ""

  # Copy webhook URL to clipboard
  echo "$WEBHOOK_URL" | pbcopy
  echo "  ✓ Copied to clipboard — just paste in Razorpay dashboard"
  echo ""

  # Open Razorpay webhooks page in browser
  open "https://dashboard.razorpay.com/app/website-app-settings/webhooks"
  echo "  ✓ Opened Razorpay webhooks page in browser"
  echo ""

  echo "  ┌─────────────────────────────────────────────────────────────────┐"
  echo "  │  Paste the webhook URL (already in clipboard) into:             │"
  echo "  │  Razorpay Dashboard → Webhooks → Edit → URL field               │"
  echo "  │                                                                  │"
  echo "  │  $WEBHOOK_URL"
  echo "  │                                                                  │"
  echo "  └─────────────────────────────────────────────────────────────────┘"
fi

# ── 6. Summary ───────────────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────"
echo " Tunnel is live"
echo "──────────────────────────────────────────"
echo " Public URL : $TUNNEL_URL"
echo " Webhook    : $WEBHOOK_URL"
echo " PID        : $TUNNEL_PID  (kill $TUNNEL_PID to stop)"
echo " Logs       : $LOG"
echo "──────────────────────────────────────────"
echo ""
echo "Press Ctrl+C to stop the tunnel."
echo ""

# Keep script alive — mirror tunnel logs to stdout
tail -f "$LOG" &
TAIL_PID=$!

# On exit, kill tunnel + tail
trap "echo ''; echo 'Stopping tunnel...'; kill $TUNNEL_PID $TAIL_PID 2>/dev/null; exit 0" INT TERM

wait $TUNNEL_PID
