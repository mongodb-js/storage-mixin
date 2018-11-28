  #!/bin/bash

echo "Unlocking the keyring..."
eval $(echo -n "" | /usr/bin/gnome-keyring-daemon --login)
eval $(/usr/bin/gnome-keyring-daemon --components=secrets --start)
export GNOME_KEYRING_CONTROL GNOME_KEYRING_PID GPG_AGENT_INFO SSH_AUTH_SOCK

echo "DBUS_SESSION_BUS_ADDRESS: ${DBUS_SESSION_BUS_ADDRESS}"

printenv

# https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=836286
dbus-run-session -- xvfb-run npm test