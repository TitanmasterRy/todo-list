#!/bin/bash
# A WireGuard VPN server on the home server, with one client (a laptop or Chromebook): see STREAM.md, "Streaming
# through a WireGuard VPN". Run with sudo on Ubuntu or Debian after `apt install wireguard`. Safe to run again: the keys
# are kept and the config is rewritten. Keys stay in /etc/wireguard (readable by root only).
set -e
# the network card the server reaches the internet through
DEV=$(ip route get 1.1.1.1 | awk '{for (i = 1; i <= NF; i++) if ($i == "dev") print $(i + 1)}')
[ -n "$DEV" ] || { echo "Couldn't work out the server's network card. Stopping before changing anything."; exit 1; }
cd /etc/wireguard
umask 077
[ -f server.key ] || wg genkey > server.key
wg pubkey < server.key > server.pub
[ -f chromebook.key ] || wg genkey > chromebook.key
wg pubkey < chromebook.key > chromebook.pub
[ -f chromebook.psk ] || wg genpsk > chromebook.psk
cat > wg0.conf <<EOF
[Interface]
Address = 10.66.66.1/24
ListenPort = 443
PrivateKey = $(cat server.key)
PostUp = iptables -I FORWARD -i wg0 -j ACCEPT; iptables -I FORWARD -o wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -s 10.66.66.0/24 -o $DEV -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -s 10.66.66.0/24 -o $DEV -j MASQUERADE

[Peer]
# Chromebook
PublicKey = $(cat chromebook.pub)
PresharedKey = $(cat chromebook.psk)
AllowedIPs = 10.66.66.2/32
EOF
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-wireguard.conf
sysctl -q --system
if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 443/udp
  ufw route allow in on wg0
fi
systemctl enable wg-quick@wg0
systemctl restart wg-quick@wg0
echo
echo "WireGuard is running on UDP 443 (network card: $DEV)."
echo "Server LAN address(es): $(hostname -I)"
