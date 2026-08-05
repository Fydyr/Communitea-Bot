<p align="center">
	<img src="./src/assets/img/banniere.svg" alt="communitea-bot-banner" width="800">
</p>
<p align="center">
	<em>Un bot Discord complet avec modération avancée et anecdotes informatiques quotidiennes</em>
</p>
<p align="center">
	<img src="https://img.shields.io/github/license/Fydyr/communitea-bot?style=plastic&logo=opensourceinitiative&logoColor=white&color=0080ff" alt="license">
	<img src="https://img.shields.io/github/last-commit/Fydyr/communitea-bot?style=plastic&logo=git&logoColor=white&color=0080ff" alt="last-commit">
	<img src="https://img.shields.io/github/languages/top/Fydyr/communitea-bot?style=plastic&color=0080ff" alt="repo-top-language">
	<img src="https://img.shields.io/github/languages/count/Fydyr/communitea-bot?style=plastic&color=0080ff" alt="repo-language-count">
</p>
<p align="center">Built with the tools and technologies:</p>
<p align="center">
	<img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=plastic&logo=TypeScript&logoColor=white" alt="TypeScript">
	<img src="https://img.shields.io/badge/Discord.js-5865F2.svg?style=plastic&logo=Discord&logoColor=white" alt="Discord.js">
	<img src="https://img.shields.io/badge/Node.js-339933.svg?style=plastic&logo=Node.js&logoColor=white" alt="Node.js">
	<img src="https://img.shields.io/badge/npm-CB3837.svg?style=plastic&logo=npm&logoColor=white" alt="npm">
	<img src="https://img.shields.io/badge/Docker-2496ED.svg?style=plastic&logo=Docker&logoColor=white" alt="Docker">
	<img src="https://img.shields.io/badge/Google%20Gemini-8E75B2.svg?style=plastic&logo=Google&logoColor=white" alt="Google Gemini">
	<img src="https://img.shields.io/badge/Axios-5A29E4.svg?style=plastic&logo=Axios&logoColor=white" alt="Axios">
</p>
<br>

## 🔗 Quick Links

- [📍 Overview](#-overview)
- [👾 Features](#-features)
- [📁 Project Structure](#-project-structure)
  - [📂 Project Index](#-project-index)
- [🚀 Getting Started](#-getting-started)
  - [☑️ Prerequisites](#-prerequisites)
  - [⚙️ Installation](#-installation)
  - [🤖 Usage](#🤖-usage)
  - [🧪 Testing](#🧪-testing)
- [📌 Project Roadmap](#-project-roadmap)
- [🔰 Contributing](#-contributing)
- [🎗 License](#-license)
- [🙌 Acknowledgments](#-acknowledgments)

---

## 📍 Overview

Communitea-Bot est un bot Discord moderne et complet, développé en TypeScript avec Discord.js v14. Il offre quatre fonctionnalités principales :

**🛡️ Système de Modération Complet**
- Gestion avancée des infractions (avertissements, expulsions, bannissements, timeouts)
- Modération automatique avec analyse intelligente des messages via IA
- Système d'actions automatiques basé sur le nombre d'infractions
- Journalisation complète des actions de modération
- Nettoyage automatique des infractions expirées

**📚 Anecdotes Informatiques Quotidiennes**
- Envoi automatique d'anecdotes deux fois par jour (8h00 et 20h00)
- Génération intelligente via l'API Gemini de Google
- Fallback sur Wikipedia en cas d'indisponibilité
- Sujets variés : langages, entreprises tech, personnalités, innovations, histoire de l'informatique

**🧠 Quiz Interactifs et Progression**
- Quiz manuels (`/quiz`) ou programmés aux heures choisies par le serveur
- Questions générées via l'API Gemini, avec mémoire des questions déjà posées
- Système d'XP et de niveaux, classements serveur (`/leaderboard`, `/quiz-leaderboard`)

**📰 News Tech Quotidiennes**
- Digest d'actualités envoyé aux heures configurées par le serveur (`/news-setup`, `/newshour-add`)
- Sourcing en cascade : flux RSS, puis recherche web Gemini, puis génération Gemini
- Résumés dans la langue du serveur, thèmes personnalisables et anti-doublon sur 7 jours

---

## 👾 Features

### 🛡️ Modération

| Commande | Description | Permissions |
|----------|-------------|-------------|
| `/warn <membre> <raison>` | Émet un avertissement à un membre | Modérer les membres |
| `/unwarn <membre> [id]` | Retire un avertissement spécifique ou le plus récent | Modérer les membres |
| `/kick <membre> <raison>` | Expulse un membre du serveur | Expulser des membres |
| `/ban <membre> <raison> [messages]` | Bannit un membre (avec suppression optionnelle de messages) | Bannir des membres |
| `/unban <id> <raison>` | Révoque le bannissement d'un utilisateur | Bannir des membres |
| `/timeout <membre> <durée> <raison>` | Met un membre en timeout (1-40320 minutes) | Modérer les membres |
| `/untimeout <membre>` | Retire le timeout d'un membre | Modérer les membres |
| `/warnings <membre>` | Affiche les avertissements actifs d'un membre | Modérer les membres |
| `/history <membre>` | Affiche l'historique complet des infractions | Modérer les membres |
| `/modlogs [limite]` | Affiche les logs de modération récents (max 25) | Modérer les membres |
| `/stats` | Affiche les statistiques de modération du serveur | Modérer les membres |

**Modération Automatique :**
- Détection automatique de spam et flood
- Analyse du langage toxique et insultes
- Actions automatiques configurables (avertissement, expulsion après 3 warns, ban après 5 warns)
- Logging en temps réel via webhook Discord

### 📚 Anecdotes

Configuration des channels (Admin) :
- `/setup` : Configure un channel pour recevoir les anecdotes (rôle à mentionner optionnel)
- `/remove` : Retire un channel de la configuration
- `/list` : Liste les channels configurés sur ce serveur
- `/stats` : Affiche les statistiques des anecdotes
- `/send-anecdote` : Envoie manuellement une anecdote (propriétaire seulement)

Planification par serveur (Admin) :
- `/hour-add` et `/hour-remove` : Ajoute/retire une heure d'envoi (0-23)
- `/timezone` : Définit le fuseau horaire (ex: `Europe/Paris`, `America/New_York`)
- `/language` : Définit la langue des anecdotes **et** des messages du bot (fr, en, es, de, it)
- `/schedule` : Affiche l'horaire courant (heures, fuseau, langue)

Par défaut (sans configuration) : envoi à 8h00 et 20h00, fuseau Europe/Paris, en français.

- Génération par IA (Gemini) avec sources vérifiables, dans la langue du serveur
- Fallback Wikipedia dans la langue configurée
- Plus de 60 sujets tech différents couverts par langue

### 📰 News quotidiennes

Configuration des channels (Admin) :
| Commande | Description |
|---|---|
| `/news-setup <salon> [role]` | Configure le salon qui recevra les news quotidiennes |
| `/news-remove <salon>` | Retire un salon de la configuration des news |
| `/news-list` | Liste les salons de news configurés |

Planification par serveur (Admin) :
| Commande | Description |
|---|---|
| `/newshour-add <heure>` | Ajoute une heure d'envoi des news (0-23) |
| `/newshour-remove <heure>` | Retire une heure d'envoi des news |

Envoi manuel (Admin) :
| Commande | Description |
|---|---|
| `/news` | Envoie immédiatement le digest de news |

À chaque heure configurée via `/newshour-add`, le bot publie un digest de 3 à 5
actualités tech dans les salons déclarés par `/news-setup`, en respectant les
thèmes (`/theme-add`), la langue et le fuseau horaire du serveur.

Les articles proviennent en priorité de flux RSS ; si aucun flux n'est
exploitable, le bot interroge Gemini avec la recherche Google, puis, en dernier
recours, Gemini seul — l'embed indique alors que le contenu n'est pas vérifié.

Si les trois sources échouent, l'envoi est retenté 30 minutes plus tard, jusqu'à
trois tentatives par créneau. Une même URL n'est jamais républiée deux fois sur
un serveur dans un intervalle de sept jours.

### 🔧 Utilitaires

- `/ping` : Vérifie la latence du bot et de l'API Discord
- Système de logging avancé avec codes couleur
- Gestion globale des erreurs et exceptions
- Nettoyage automatique des infractions expirées (toutes les heures)

---

## 📁 Project Structure

```sh
└── communitea-bot/
    ├── Dockerfile
    ├── README.md
    ├── deploy.sh
    ├── docker-compose.yml
    ├── package-lock.json
    ├── package.json
    ├── src
    │   ├── config
    │   │   └── index.ts
    │   ├── controllers
    │   │   ├── AnecdoteController.ts
    │   │   ├── ModerationController.ts
    │   │   ├── ModerationInfoController.ts
    │   │   └── PingController.ts
    │   ├── index.ts
    │   ├── middlewares
    │   │   └── Logger.ts
    │   ├── models
    │   │   ├── Infraction.ts
    │   │   └── User.ts
    │   ├── services
    │   │   ├── AnecdoteService.ts
    │   │   ├── AutoModerationService.ts
    │   │   ├── GeminiService.ts
    │   │   ├── LoggerService.ts
    │   │   ├── ModerationService.ts
    │   │   ├── PingService.ts
    │   │   └── TranslationService.ts
    │   └── utils
    │       └── embed.ts
    └── tsconfig.json
```


### 📂 Project Index
<details open>
	<summary><b><code>COMMUNITEA-BOT/</code></b></summary>
	<details> <!-- __root__ Submodule -->
		<summary><b>__root__</b></summary>
		<blockquote>
			<table>
			<tr>
				<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/package-lock.json'>package-lock.json</a></b></td>
				<td>Fichier de verrouillage des dépendances npm</td>
			</tr>
			<tr>
				<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/tsconfig.json'>tsconfig.json</a></b></td>
				<td>Configuration du compilateur TypeScript</td>
			</tr>
			<tr>
				<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/package.json'>package.json</a></b></td>
				<td>Manifeste du projet avec dépendances et scripts</td>
			</tr>
			<tr>
				<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/deploy.sh'>deploy.sh</a></b></td>
				<td>Script de déploiement automatisé</td>
			</tr>
			<tr>
				<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/docker-compose.yml'>docker-compose.yml</a></b></td>
				<td>Configuration Docker Compose pour le déploiement</td>
			</tr>
			<tr>
				<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/Dockerfile'>Dockerfile</a></b></td>
				<td>Configuration de l'image Docker du bot</td>
			</tr>
			</table>
		</blockquote>
	</details>
	<details> <!-- src Submodule -->
		<summary><b>src</b></summary>
		<blockquote>
			<table>
			<tr>
				<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/index.ts'>index.ts</a></b></td>
				<td>Point d'entrée principal du bot avec configuration du client Discord, gestionnaires d'événements et planificateur cron</td>
			</tr>
			</table>
			<details>
				<summary><b>middlewares</b></summary>
				<blockquote>
					<table>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/middlewares/Logger.ts'>Logger.ts</a></b></td>
						<td>Middleware de journalisation des interactions et commandes</td>
					</tr>
					</table>
				</blockquote>
			</details>
			<details>
				<summary><b>config</b></summary>
				<blockquote>
					<table>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/config/index.ts'>index.ts</a></b></td>
						<td>Configuration centralisée avec variables d'environnement (tokens, IDs de channels, paramètres de modération)</td>
					</tr>
					</table>
				</blockquote>
			</details>
			<details>
				<summary><b>controllers</b></summary>
				<blockquote>
					<table>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/controllers/PingController.ts'>PingController.ts</a></b></td>
						<td>Commande /ping pour vérifier la latence du bot</td>
					</tr>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/controllers/ModerationController.ts'>ModerationController.ts</a></b></td>
						<td>Commandes de modération (warn, kick, ban, timeout, etc.)</td>
					</tr>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/controllers/AnecdoteController.ts'>AnecdoteController.ts</a></b></td>
						<td>Commande /send-anecdote pour envoyer manuellement une anecdote</td>
					</tr>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/controllers/ModerationInfoController.ts'>ModerationInfoController.ts</a></b></td>
						<td>Commande /warnings pour consulter l'historique des infractions</td>
					</tr>
					</table>
				</blockquote>
			</details>
			<details>
				<summary><b>models</b></summary>
				<blockquote>
					<table>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/models/User.ts'>User.ts</a></b></td>
						<td>Modèle de données pour les utilisateurs</td>
					</tr>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/models/Infraction.ts'>Infraction.ts</a></b></td>
						<td>Modèle de données pour les infractions (warns, kicks, bans, timeouts)</td>
					</tr>
					</table>
				</blockquote>
			</details>
			<details>
				<summary><b>utils</b></summary>
				<blockquote>
					<table>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/utils/embed.ts'>embed.ts</a></b></td>
						<td>Utilitaires pour créer des embeds Discord stylisés (succès, erreur, info)</td>
					</tr>
					</table>
				</blockquote>
			</details>
			<details>
				<summary><b>services</b></summary>
				<blockquote>
					<table>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/services/AnecdoteService.ts'>AnecdoteService.ts</a></b></td>
						<td>Gestion des anecdotes quotidiennes : récupération depuis Gemini/Wikipedia, formatage et envoi</td>
					</tr>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/services/LoggerService.ts'>LoggerService.ts</a></b></td>
						<td>Service de journalisation avec logs console colorés et webhook Discord</td>
					</tr>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/services/GeminiService.ts'>GeminiService.ts</a></b></td>
						<td>Intégration avec l'API Gemini pour la génération d'anecdotes par IA</td>
					</tr>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/services/TranslationService.ts'>TranslationService.ts</a></b></td>
						<td>Service de traduction et localisation</td>
					</tr>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/services/PingService.ts'>PingService.ts</a></b></td>
						<td>Calcul de la latence du bot et de l'API Discord</td>
					</tr>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/services/ModerationService.ts'>ModerationService.ts</a></b></td>
						<td>Logique métier de modération : gestion des infractions, actions automatiques, historique</td>
					</tr>
					<tr>
						<td><b><a href='https://github.com/Fydyr/communitea-bot/blob/master/src/services/AutoModerationService.ts'>AutoModerationService.ts</a></b></td>
						<td>Modération automatique en temps réel : détection de spam, toxicité et contenu inapproprié</td>
					</tr>
					</table>
				</blockquote>
			</details>
		</blockquote>
	</details>
</details>

---
## 🚀 Getting Started

### ☑️ Prerequisites

Avant de commencer avec communitea-bot, assurez-vous que votre environnement répond aux exigences suivantes :

- **Node.js** : Version 18 ou supérieure
- **npm** : Pour la gestion des dépendances
- **Docker** (optionnel) : Pour le déploiement conteneurisé
- **Compte Discord Developer** : Pour créer et configurer le bot
- **Clé API Gemini** (optionnel) : Pour la génération d'anecdotes par IA

### Configuration requise

Avant de commencer, vous devez obtenir :

1. **Token Discord** : Créez une application sur le [Discord Developer Portal](https://discord.com/developers/applications)
2. **ID du serveur et des channels** : Activez le mode développeur dans Discord puis clic droit > Copier l'ID
3. **Clé API Gemini** (optionnel) : Obtenez une clé sur [Google AI Studio](https://aistudio.google.com/app/apikey)
4. **Webhook Discord** (optionnel) : Pour les logs en temps réel

### Configuration des variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
# Discord Bot Configuration
DISCORD_TOKEN=votre_token_discord_bot
DISCORD_GUILD_ID=votre_guild_id

# Channels IDs
STATUS_CHANNEL_ID=id_channel_status
ANECDOTE_CHANNEL_ID=id_channel_anecdotes
MOD_LOG_CHANNEL_ID=id_channel_logs_moderation

# Webhook pour les logs (optionnel)
LOG_WEBHOOK_URL=https://discord.com/api/webhooks/...

# API Keys
GEMINI_API_KEY=votre_cle_api_gemini

# Modération
AUTOMOD_ENABLED=true
MAX_WARNINGS_BEFORE_KICK=3
MAX_WARNINGS_BEFORE_BAN=5
```


### ⚙️ Installation

Install communitea-bot using one of the following methods:

**Build from source:**

1. Clone the communitea-bot repository:
```sh
❯ git clone https://github.com/Fydyr/communitea-bot
```

2. Navigate to the project directory:
```sh
❯ cd communitea-bot
```

3. Install the project dependencies:


**Using `npm`** &nbsp; [<img align="center" src="https://img.shields.io/badge/npm-CB3837.svg?style={badge_style}&logo=npm&logoColor=white" />](https://www.npmjs.com/)

```sh
❯ npm install
```


**Using `docker`** &nbsp; [<img align="center" src="https://img.shields.io/badge/Docker-2CA5E0.svg?style={badge_style}&logo=docker&logoColor=white" />](https://www.docker.com/)

```sh
❯ docker build -t Fydyr/communitea-bot .
```




### 🤖 Usage

#### Mode développement

Lancez le bot en mode développement avec rechargement automatique :

```sh
❯ npm run dev
```

#### Mode production

Compilez le TypeScript puis lancez le bot :

```sh
❯ npm run build
❯ npm start
```

#### Avec Docker

Construisez et lancez le conteneur Docker :

```sh
❯ docker-compose up -d
```

Ou utilisez le script de déploiement :

```sh
❯ ./deploy.sh
```

### Permissions Discord requises

Lors de l'ajout du bot à votre serveur, accordez-lui les permissions suivantes :

- Lire les messages / Voir les salons
- Envoyer des messages
- Intégrer des liens (embeds)
- Gérer les messages
- Expulser des membres
- Bannir des membres
- Modérer des membres (timeout)
- Utiliser les commandes slash

**URL d'invitation** : Remplacez `YOUR_CLIENT_ID` par l'ID de votre application

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=1099780063494&scope=bot%20applications.commands
```


### 🧪 Testing

Le projet utilise [Vitest](https://vitest.dev/) avec deux niveaux de tests :

- **Tests unitaires** — logique pure sans I/O (calcul XP/niveaux, réparation JSON, mélange des réponses de quiz, helpers de fuseau horaire) et tests de contrôleurs avec interactions Discord mockées.
- **Tests d'intégration** — services Prisma exécutés contre un PostgreSQL jetable démarré via [Testcontainers](https://testcontainers.com/) (Docker requis), Discord et Gemini étant mockés.

```bash
npm run test:unit          # tests unitaires (rapides, sans Docker)
npm run test:integration   # tests d'intégration (Docker requis)
npm test                   # toute la suite
npm run test:watch         # mode watch
npm run test:coverage      # rapport de couverture
```

Les tests s'exécutent aussi automatiquement en CI (GitHub Actions) sur chaque push et pull request.


---
## 📌 Project Roadmap

### Fonctionnalités implémentées

- [X] Système d'anecdotes quotidiennes avec IA (Gemini)
- [X] Logging avancé avec webhook Discord
- [X] Actions automatiques basées sur le nombre d'avertissements
- [X] Déploiement Docker
- [X] Nettoyage automatique des infractions expirées
- [X] Support multi-langues pour les anecdotes et messages du bot
- [X] Système de quiz interactif (manuel et programmé) avec mémoire par serveur
- [X] Base de données persistante (PostgreSQL via Prisma)
- [X] Support multi-serveurs (paramètres par serveur)
- [X] Commandes de configuration dynamiques (horaires, fuseau, langue, thèmes, salons)
- [X] Statistiques et progression (XP, niveaux)
- [X] Classement XP et quiz par serveur (`/leaderboard`, `/quiz-leaderboard`)
- [X] Tests unitaires et d'intégration (Vitest + Testcontainers) avec CI GitHub Actions

### Améliorations futures

- [ ] Système de rôles et permissions personnalisables
- [ ] Commandes de divertissement (jeux, musique)
- [ ] Tableau de bord web de configuration

---

## 🔰 Contributing

- **💬 [Join the Discussions](https://github.com/Fydyr/communitea-bot/discussions)**: Share your insights, provide feedback, or ask questions.
- **🐛 [Report Issues](https://github.com/Fydyr/communitea-bot/issues)**: Submit bugs found or log feature requests for the `communitea-bot` project.
- **💡 [Submit Pull Requests](https://github.com/Fydyr/communitea-bot/blob/main/CONTRIBUTING.md)**: Review open PRs, and submit your own PRs.

<details closed>
<summary>Contributing Guidelines</summary>

1. **Fork the Repository**: Start by forking the project repository to your github account.
2. **Clone Locally**: Clone the forked repository to your local machine using a git client.
   ```sh
   git clone https://github.com/Fydyr/communitea-bot
   ```
3. **Create a New Branch**: Always work on a new branch, giving it a descriptive name.
   ```sh
   git checkout -b new-feature-x
   ```
4. **Make Your Changes**: Develop and test your changes locally.
5. **Commit Your Changes**: Commit with a clear message describing your updates.
   ```sh
   git commit -m 'Implemented new feature x.'
   ```
6. **Push to github**: Push the changes to your forked repository.
   ```sh
   git push origin new-feature-x
   ```
7. **Submit a Pull Request**: Create a PR against the original project repository. Clearly describe the changes and their motivations.
8. **Review**: Once your PR is reviewed and approved, it will be merged into the main branch. Congratulations on your contribution!
</details>

<details closed>
<summary>Contributor Graph</summary>
<br>
<p align="left">
   <a href="https://github.com{/Fydyr/communitea-bot/}graphs/contributors">
      <img src="https://contrib.rocks/image?repo=Fydyr/communitea-bot">
   </a>
</p>
</details>

---

## 🎗 License

Ce projet est sous licence ISC. Voir le fichier package.json pour plus de détails.

---

## 🙌 Acknowledgments

### Technologies utilisées

- **[Discord.js](https://discord.js.org/)** - Bibliothèque puissante pour interagir avec l'API Discord
- **[discordx](https://discordx.js.org/)** - Framework élégant avec décorateurs TypeScript
- **[Google Generative AI](https://ai.google.dev/)** - API Gemini pour la génération d'anecdotes
- **[node-cron](https://www.npmjs.com/package/node-cron)** - Planification des tâches automatiques
- **[TypeScript](https://www.typescriptlang.org/)** - Typage statique pour un code robuste

### Ressources

- [Discord Developer Portal](https://discord.com/developers/docs) - Documentation officielle Discord
- [Discord.js Guide](https://discordjs.guide/) - Guide complet pour Discord.js
- [Wikipedia API](https://www.mediawiki.org/wiki/API:Main_page) - Source de fallback pour les anecdotes

### Support

Pour toute question ou problème :
- Ouvrez une [issue](https://github.com/Fydyr/communitea-bot/issues) sur GitHub
- Consultez la [documentation Discord.js](https://discord.js.org/#/docs/)

---

**Note** : Ce bot est développé à des fins de gestion de communauté et d'éducation. Assurez-vous de respecter les [Terms of Service de Discord](https://discord.com/terms) et les [Developer Terms](https://discord.com/developers/docs/policies-and-agreements/developer-terms-of-service).

---
