# Simple Logging Server

Un système complet pour enregistrer les événements utilisateur avec interface de visualisation.

## Fonctionnalités

✅ **Enregistrement des événements**
- Création de compte (`account_created`)
- Connexion (`login`, `login_failed`)
- Déconnexion (`logout`)
- Envoi de messages (`message_sent`, `message_send_failed`)
- Mise à jour de profil (`account_updated`)
- Erreurs de validation (`validation_failed`)
- Erreurs JavaScript non gérées (`error`)

✅ **Rotation automatique des logs**
- Limite par fichier : 5 MB
- Anciens logs archivés avec timestamp

✅ **Dashboard web de consultation**
- URL : `http://localhost:3000/logs.html`
- Filtrage par type d'événement
- Rafraîchissement automatique (3 sec)
- Suppression des logs

## Installation & Lancement

```powershell
# depuis le dossier du projet
npm install
npm start
```

Puis ouvrez :
- **App** : `http://localhost:3000/index.html`
- **Dashboard** : `http://localhost:3000/logs.html`

### Protection par mot de passe

Le dashboard est protégé par HTTP Basic Auth. Définissez les variables d'environnement `ADMIN_USER` et `ADMIN_PASS` avant de démarrer le serveur.

Localement :
```powershell
$env:ADMIN_USER='admin'
$env:ADMIN_PASS='votre_mot_de_passe'
npm start
```

Sur Railway :
- Ouvrez votre projet → Settings → Variables
- Ajoutez `ADMIN_USER` et `ADMIN_PASS` et redéployez

Lorsque vous accédez à `/logs.html`, le navigateur vous demandera le nom d'utilisateur et le mot de passe.

## Fichiers JSON des logs

Consultez `logs/app.log` pour les logs en format JSON, ligne par ligne.

Chaque ligne ressemble à :
```json
{"timestamp":"2026-02-07T18:00:00.000Z","body":{"type":"login","payload":{"user":"john"},"ts":"...", "url":"/home.html"}}
```

## API

- `POST /log` - Envoyer un log (appelé automatiquement par le client)
- `GET /logs?type=login&limit=100` - Récupérer les logs (utilisé par le dashboard)
- `POST /clear-logs` - Supprimer tous les logs

