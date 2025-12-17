#!/bin/bash
set -e

# Initialize IPFS if not already done
if [ ! -d ~/.ipfs ]; then
    ipfs init --profile server
fi

# Start IPFS daemon in background
ipfs daemon --enable-gc &
sleep 5

# Add SSH keys if provided via environment
if [ -n "$SSH_AUTHORIZED_KEYS" ]; then
    mkdir -p ~/.ssh
    echo "$SSH_AUTHORIZED_KEYS" > ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
fi

# Start SSH server
/usr/sbin/sshd

# Execute startup script if provided (base64 encoded)
if [ -n "$STARTUP_SCRIPT_B64" ]; then
    echo "Executing startup script..."
    echo "$STARTUP_SCRIPT_B64" | base64 -d > /tmp/startup.sh
    chmod +x /tmp/startup.sh
    /tmp/startup.sh
fi

# If command provided, execute it
if [ $# -gt 0 ]; then
    exec "$@"
else
    # Keep container running
    echo "Container ready. Waiting for commands..."
    tail -f /dev/null
fi
