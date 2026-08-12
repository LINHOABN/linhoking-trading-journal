//+------------------------------------------------------------------+
//|                                         LinhokingBridge.mq5        |
//|  Pousse chaque position fermée vers l'API LINHOKING Trading       |
//|  Journal via WebRequest (HTTP POST JSON).                         |
//|                                                                    |
//|  INSTALLATION :                                                   |
//|  1. Copier ce fichier dans MQL5/Experts/ puis compiler dans        |
//|     MetaEditor (F7).                                              |
//|  2. Dans MT5 : Outils > Options > Expert Advisors > cocher         |
//|     "Autoriser WebRequest pour les URL listées" et ajouter         |
//|     l'URL de ton API (ex: https://ton-api.up.railway.app).         |
//|  3. Attacher l'EA au graphique XAU/USD, renseigner ApiBaseUrl      |
//|     et ApiKey (visible dans le dashboard LINHOKING après          |
//|     connexion, endpoint /mt5/rotate-key pour en générer une).      |
//|                                                                    |
//|  LIMITES CONNUES :                                                 |
//|  - WebRequest est bloquant : un délai réseau ralentit le thread    |
//|    de l'EA. Pour un usage intensif, préférer un service            |
//|    intermédiaire (option 2 du projet) plutôt que l'EA direct.      |
//|  - MT5 ne permet pas d'ouvrir de connexions arbitraires : seules   |
//|    les URLs explicitement autorisées fonctionnent.                 |
//+------------------------------------------------------------------+
#property copyright "LINHOKING"
#property version   "1.00"
#property strict

input string ApiBaseUrl = "https://your-api-domain.example.com"; // Base URL de l'API FastAPI
input string ApiKey     = "PASTE-YOUR-MT5-API-KEY-HERE";          // Clé API (header X-API-Key)
input int    TimeoutMs  = 5000;

//+------------------------------------------------------------------+
//| Convertit un datetime MT5 en chaîne ISO 8601 UTC                  |
//+------------------------------------------------------------------+
string ToIso8601(datetime t)
{
   MqlDateTime dt;
   TimeToStruct(t, dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02d",
                       dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
}

//+------------------------------------------------------------------+
//| Envoie un trade fermé à l'API via POST /mt5/webhook               |
//+------------------------------------------------------------------+
void SendClosedTrade(ulong ticket, string symbol, string direction,
                      double volume, double entryPrice, double exitPrice,
                      double sl, double tp, double pnl,
                      datetime openTime, datetime closeTime)
{
   string url = ApiBaseUrl + "/mt5/webhook";

   string json = StringFormat(
      "{\"ticket\":\"%I64u\",\"symbol\":\"%s\",\"direction\":\"%s\","
      "\"volume\":%.2f,\"entry_price\":%.2f,\"exit_price\":%.2f,"
      "\"stop_loss\":%.2f,\"take_profit\":%.2f,\"pnl\":%.2f,"
      "\"open_time\":\"%s\",\"close_time\":\"%s\"}",
      ticket, symbol, direction,
      volume, entryPrice, exitPrice,
      sl, tp, pnl,
      ToIso8601(openTime), ToIso8601(closeTime)
   );

   string headers = "Content-Type: application/json\r\nX-API-Key: " + ApiKey + "\r\n";
   char postData[];
   StringToCharArray(json, postData, 0, StringLen(json));

   char result[];
   string resultHeaders;

   int status = WebRequest("POST", url, headers, TimeoutMs, postData, result, resultHeaders);

   if(status == -1)
   {
      Print("LinhokingBridge: WebRequest a échoué. Vérifie que l'URL est autorisée dans ",
            "Outils > Options > Expert Advisors. Erreur: ", GetLastError());
   }
   else if(status != 200 && status != 201)
   {
      Print("LinhokingBridge: réponse API ", status, " — ", CharArrayToString(result));
   }
   else
   {
      Print("LinhokingBridge: trade ", ticket, " synchronisé avec succès.");
   }
}

//+------------------------------------------------------------------+
//| Détecte les positions fermées via l'historique des deals          |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                         const MqlTradeRequest &request,
                         const MqlTradeResult &result)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;

   ulong dealTicket = trans.deal;
   if(!HistoryDealSelect(dealTicket))
      return;

   // On ne traite que les deals qui ferment une position (sortie de marché)
   long entryType = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
   if(entryType != DEAL_ENTRY_OUT)
      return;

   ulong positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
   string symbol    = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
   double volume    = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
   double exitPrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
   double pnl       = HistoryDealGetDouble(dealTicket, DEAL_PROFIT)
                     + HistoryDealGetDouble(dealTicket, DEAL_SWAP)
                     + HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
   datetime closeTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
   long dealDirection  = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
   string direction = (dealDirection == DEAL_TYPE_SELL) ? "BUY" : "SELL";
   // Un deal de sortie SELL clôture une position BUY, et inversement.

   // Recherche du deal d'entrée correspondant pour prix d'entrée / SL / TP / heure d'ouverture
   double entryPrice = 0, sl = 0, tp = 0;
   datetime openTime = closeTime;

   if(HistorySelectByPosition(positionId))
   {
      int deals = HistoryDealsTotal();
      for(int i = 0; i < deals; i++)
      {
         ulong dTicket = HistoryDealGetTicket(i);
         if(HistoryDealGetInteger(dTicket, DEAL_ENTRY) == DEAL_ENTRY_IN)
         {
            entryPrice = HistoryDealGetDouble(dTicket, DEAL_PRICE);
            openTime   = (datetime)HistoryDealGetInteger(dTicket, DEAL_TIME);
            break;
         }
      }
   }

   SendClosedTrade(positionId, symbol, direction, volume,
                    entryPrice, exitPrice, sl, tp, pnl, openTime, closeTime);
}


//+------------------------------------------------------------------+
//| Envoie le solde et l'équité du compte via POST /mt5/balance      |
//+------------------------------------------------------------------+
void SendBalance()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);

   string url = ApiBaseUrl + "/mt5/balance";
   string json = StringFormat("{\"balance\":%.2f,\"equity\":%.2f}", balance, equity);

   string headers = "Content-Type: application/json\r\nX-API-Key: " + ApiKey + "\r\n";
   char postData[];
   StringToCharArray(json, postData, 0, StringLen(json));

   char result[];
   string resultHeaders;

   int status = WebRequest("POST", url, headers, TimeoutMs, postData, result, resultHeaders);
   if(status == -1)
      Print("LinhokingBridge: erreur envoi solde — ", GetLastError());
   else
      Print("LinhokingBridge: solde synchronisé — Balance=", balance, " Equity=", equity);
}

//+------------------------------------------------------------------+
int OnInit()
{
   Print("LinhokingBridge initialisé — API: ", ApiBaseUrl);
   EventSetTimer(60);   // envoie le solde toutes les 60 secondes
   SendBalance();       // premier envoi immédiat au démarrage
   return(INIT_SUCCEEDED);
}

void OnTimer()
{
   SendBalance();
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("LinhokingBridge arrêté.");
}
