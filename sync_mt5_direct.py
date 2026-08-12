import sys, json, urllib.request, urllib.error
from datetime import datetime, timezone

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

API_KEY = "e9c802eb-e7ae-4c43-80b4-caf66cf0fe83"
BASE_URL = "http://localhost:8000"

def post_json(endpoint, payload):
    url = BASE_URL + endpoint
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json", "X-API-Key": API_KEY},
        method="POST"
    )
    try:
        res = urllib.request.urlopen(req)
        return res.getcode(), json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')
    except Exception as e:
        return 0, str(e)

print("==================================================")
print("   LINHOKING - Synchronisation Directe MT5        ")
print("==================================================")

try:
    import MetaTrader5 as mt5
except ImportError:
    print("Erreur: Le module MetaTrader5 n'est pas installé.")
    sys.exit(1)

if not mt5.initialize():
    print("❌ Impossible de se connecter à MetaTrader 5.")
    print("Assurez-vous que MetaTrader 5 est ouvert sur votre ordinateur !")
    print("Code d'erreur MT5:", mt5.last_error())
    sys.exit(1)

acc = mt5.account_info()
if acc is None:
    print("❌ Impossible de lire les informations du compte MT5.")
    mt5.shutdown()
    sys.exit(1)

print(f"✅ Connecté à MT5!")
print(f"   Compte   : {acc.login}")
print(f"   Courtier : {acc.company}")
print(f"   Solde    : {acc.balance} {acc.currency}")
print(f"   Équité   : {acc.equity} {acc.currency}")

# 1. Envoi des informations du compte et du solde
code, res = post_json("/mt5/balance", {
    "balance": float(acc.balance),
    "equity": float(acc.equity),
    "account_number": str(acc.login),
    "broker": str(acc.company),
    "leverage": int(acc.leverage),
    "currency": str(acc.currency)
})

if code in (200, 201):
    print("✅ Solde et informations du compte synchronisés avec l'application LINHOKING !")
else:
    print(f"❌ Erreur lors de la synchronisation du solde (HTTP {code}):", res)

# 2. Récupération de l'historique des trades fermés
print("\n🔍 Analyse de l'historique des trades MT5...")
from_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
to_date = datetime.now(timezone.utc)

deals = mt5.history_deals_get(from_date, to_date)
if deals is None or len(deals) == 0:
    print("Aucun trade trouvé dans l'historique MT5.")
else:
    print(f"Trouvé {len(deals)} transactions dans MT5. Synchronisation en cours...")
    synced = 0
    for d in deals:
        # DEAL_ENTRY_OUT (1) = sortie de position
        if d.entry != 1:
            continue
        
        position_id = str(d.position_id if d.position_id > 0 else d.ticket)
        symbol = d.symbol or "XAUUSD"
        volume = float(d.volume)
        exit_price = float(d.price)
        pnl = float(d.profit + d.swap + d.commission)
        close_time = datetime.fromtimestamp(d.time, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        direction = "BUY" if d.type == 1 else "SELL" # DEAL_TYPE_SELL=1 => position originelle = BUY

        # Chercher le deal d'entrée
        open_time = close_time
        entry_price = exit_price
        for in_d in deals:
            if in_d.position_id == d.position_id and in_d.entry == 0: # DEAL_ENTRY_IN=0
                entry_price = float(in_d.price)
                open_time = datetime.fromtimestamp(in_d.time, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
                break

        code, res = post_json("/mt5/webhook", {
            "ticket": position_id,
            "symbol": symbol,
            "direction": direction,
            "volume": volume,
            "entry_price": entry_price,
            "exit_price": exit_price,
            "stop_loss": 0.0,
            "take_profit": 0.0,
            "pnl": pnl,
            "open_time": open_time,
            "close_time": close_time
        })
        if code in (200, 201):
            synced += 1

    print(f"✅ Synchronisation terminée: {synced} trades importés dans LINHOKING Trading Journal!")

mt5.shutdown()
