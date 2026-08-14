#!/bin/sh
# Apunta git a los hooks versionados en .githooks/. Lo corre npm install (prepare);
# fuera de un clon del repo no hace nada, para no romper la instalacion del evento.
git config core.hooksPath .githooks 2>/dev/null ||
  echo "setup-git-hooks: fuera de un repo git, no se activa nada"
exit 0
