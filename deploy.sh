#!/bin/bash

###  Script de déploiement pour Discord Bot (TypeScript)
###  Met à jour le repository Git et reconstruit le stack Docker

### Warning: Ne pas exécuter ce script si vous avez des modifications locales non commises
### Ce script est destiné au serveur de production jrcandev

set -e
cd "$(dirname "$0")"

BRANCH="main"

echo "=== Déploiement Discord Bot démarré à $(date) ==="

# Vérifier que c'est un repository Git
if [ ! -d .git ]; then
  echo "Erreur: Ce répertoire n'est pas un repository Git."
  exit 1
fi

# Détecter les changements locaux
if ! git diff-index --quiet HEAD --; then
  echo "Modifications locales détectées."
  echo "Elles seront préservées; aucun reset ne sera effectué."
  echo "(Utilisez 'git stash' ou commitez vos changements si nécessaire.)"
  LOCAL_CHANGES=true
else
  LOCAL_CHANGES=false
fi

echo "=== Récupération des derniers changements ==="
git fetch origin "$BRANCH"

if [ "$LOCAL_CHANGES" = false ]; then
  echo "=== Merge fast-forward avec le remote ==="
  git merge --ff-only "origin/$BRANCH" || {
    echo "Merge automatique impossible. Déploiement annulé."
    exit 1
  }
else
  echo "=== Pull avec rebase (préservation des changements locaux) ==="
  git pull --rebase origin "$BRANCH" || {
    echo "Rebase échoué. Déploiement annulé."
    exit 1
  }
fi

echo "=== Vérification du fichier .env ==="
if [ ! -f .env ]; then
  echo "Erreur: Le fichier .env est manquant."
  echo "Créez-le en vous basant sur .env.example"
  exit 1
fi

echo "=== Reconstruction du stack Docker ==="
docker compose down
docker compose build --no-cache
docker compose up -d

echo "=== Vérification des logs ==="
docker compose logs --tail=50

echo "=== Déploiement terminé à $(date) ==="
echo "Le bot Discord est maintenant en cours d'exécution."