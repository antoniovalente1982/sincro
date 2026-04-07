# 🚀 Hermes VPS — Guida Deploy Rapido

## Pre-requisiti
- Accesso SSH alla VPS Hostinger: `ssh root@76.13.136.176`
- Node.js 18+ installato sulla VPS
- PM2 installato globalmente: `npm install -g pm2`

## Deploy Iniziale

```bash
# 1. Connettiti alla VPS
ssh root@76.13.136.176

# 2. Crea la directory di lavoro
mkdir -p /opt/hermes && cd /opt/hermes

# 3. Copia i file dal tuo Mac (esegui dal tuo Mac, NON dalla VPS):
# scp -r ./hermes-vps-server/* root@76.13.136.176:/opt/hermes/

# 4. Installa le dipendenze sulla VPS
npm install

# 5. Apri la porta nel firewall
sudo ufw allow 8643/tcp
# oppure con iptables:
sudo iptables -A INPUT -p tcp --dport 8643 -j ACCEPT

# 6. Avvia con PM2
pm2 start index.js --name hermes
pm2 save
pm2 startup  # Per auto-restart al reboot

# 7. Verifica
curl -H "Authorization: Bearer AdPilotikHermesSecure2026!" http://localhost:8643/v1/models
# Risposta attesa: {"data":[{"id":"hermes-agent","object":"model"}]}
```

## Restart/Troubleshooting

```bash
# Vedi lo stato
pm2 list

# Vedi i log
pm2 logs hermes

# Restart
pm2 restart hermes

# Se hai aggiornato il codice
cd /opt/hermes && pm2 restart hermes
```

## Test Connessione (dal tuo Mac)
```bash
curl -H "Authorization: Bearer AdPilotikHermesSecure2026!" http://76.13.136.176:8643/v1/models
```
