FROM node:20-alpine

# Installer git et openssh-client pour pouvoir cloner des repos privés si nécessaire
RUN apk add --no-cache git openssh-client bash openssl

WORKDIR /usr/src/app

# Les arguments de build permettront de passer les variables au moment du build
ARG GIT_URL
ARG GIT_BRANCH=main

# Cloner le repository directement dans le répertoire de travail
RUN if [ -z "$GIT_URL" ]; then \
        echo "Erreur: GIT_URL non fourni"; \
        exit 1; \
    fi && \
    echo "Clonage depuis: ${GIT_URL} (branche: ${GIT_BRANCH})" && \
    cd /usr/src && \
    git clone --branch ${GIT_BRANCH} ${GIT_URL} app-temp && \
    echo "=== Contenu cloné ===" && \
    ls -la app-temp && \
    # Copier le contenu dans app (qui existe déjà via WORKDIR)
    cp -r app-temp/. app/ && \
    rm -rf app-temp && \
    echo "=== Contenu final dans /usr/src/app ===" && \
    ls -la /usr/src/app

# Installer les dépendances
RUN npm install --production=false

# Compiler le TypeScript
RUN npm run build

# Supprimer les devDependencies pour réduire la taille de l'image
RUN npm prune --production

# Exposer le port si nécessaire (optionnel pour Discord bot)
# EXPOSE 3000

# Lancer l'application compilée
CMD ["sh", "-c", "npm run prisma:migrate:prod && npm start"]
