//+------------------------------------------------------------------+
//|                                         LinhokingBridge.mq5        |
//|  Pousse chaque position fermée et l'historique complet des trades  |
//|  vers l'API LINHOKING Trading Journal via WebRequest (HTTP POST). |
//|                                                                    |
//|  INSTALLATION :                                                   |
//|  1. Copier ce fichier dans MQL5/Experts/ puis compiler dans        |
//|     MetaEditor (F7).                                              |
//|  2. Dans MT5 : Outils > Options > Expert Advisors > cocher         |
//|     "Autoriser WebRequest pour les URL listées" et ajouter         |
//|     l'URL de l'API (ex: http://localhost:8000).                   |
//|  3. Attacher l'EA au graphique, renseigner ApiBaseUrl              |
//|     et ApiKey (visible dans le dashboard LINHOKING après           |
//|     connexion).                                                   |
//+------------------------------------------------------------------+
#property copyright "LINHOKING"
#property version   "1.20"
#property strict

input string ApiBaseUrl = "https://linhoking-trading-journal.vercel.app"; // Base URL de l'API FastAPI (Vercel Production)
input string ApiKey     = "PASTE-YOUR-MT5-API-KEY-HERE";               // Clé API (header X-API-Key)
input int    TimeoutMs  = 5000;

//+------------------------------------------------------------------+
//| Convertit un datetime MT5 en chaîne ISO 8601 strict              |
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
bool SendClosedTrade(ulong ticket, string symbol, string direction,
                     double volume, double entryPrice, double exitPrice,
                     double sl, double tp, double pnl,
                     datetime openTime, datetime closeTime)
{
   string url = ApiBaseUrl + "/mt5/webhook";

   string json = StringFormat(
      "{\"ticket\":\"%I64u\",\"symbol\":\"%s\",\"direction\":\"%s\","
      "\"volume\":%.2f,\"entry_price\":%.5f,\"exit_price\":%.5f,"
      "\"stop_loss\":%.5f,\"take_profit\":%.5f,\"pnl\":%.2f,"
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
      return false;
   }
   else if(status != 200 && status != 201)
   {
      Print("LinhokingBridge: réponse API ", status, " — ", CharArrayToString(result));
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Envoie le solde et les détails du compte via POST /mt5/balance   |
//+------------------------------------------------------------------+
void SendBalance()
{
   double balance     = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity      = AccountInfoDouble(ACCOUNT_EQUITY);
   long   accNumber   = AccountInfoInteger(ACCOUNT_LOGIN);
   string company     = AccountInfoString(ACCOUNT_COMPANY);
   long   leverage    = AccountInfoInteger(ACCOUNT_LEVERAGE);
   string currency    = AccountInfoString(ACCOUNT_CURRENCY);

   string url = ApiBaseUrl + "/mt5/balance";
   string json = StringFormat(
      "{\"balance\":%.2f,\"equity\":%.2f,\"account_number\":\"%I64d\","
      "\"broker\":\"%s\",\"leverage\":%d,\"currency\":\"%s\"}",
      balance, equity, accNumber, company, leverage, currency
   );

   string headers = "Content-Type: application/json\r\nX-API-Key: " + ApiKey + "\r\n";
   char postData[];
   StringToCharArray(json, postData, 0, StringLen(json));

   char result[];
   string resultHeaders;

   int status = WebRequest("POST", url, headers, TimeoutMs, postData, result, resultHeaders);
   if(status == -1)
      Print("LinhokingBridge: erreur envoi solde — ", GetLastError());
   else
      Print("LinhokingBridge: solde et compte synchronisés — Compte=", accNumber, " Broker=", company, " Balance=", balance);
}

//+------------------------------------------------------------------+
//| Parcourt tout l'historique MT5 et synchronise les past trades    |
//+------------------------------------------------------------------+
void SyncHistory()
{
   Print("LinhokingBridge: Analyse de l'historique des trades MT5...");
   if(!HistorySelect(0, TimeCurrent()))
   {
      Print("LinhokingBridge: impossible de charger l'historique MT5.");
      return;
   }

   int totalDeals = HistoryDealsTotal();
   int syncedCount = 0;

   for(int i = 0; i < totalDeals; i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket <= 0) continue;

      long entryType = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      if(entryType != DEAL_ENTRY_OUT) continue; // Seuls les deals de sortie nous intéressent

      ulong positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
      string symbol    = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
      double volume    = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
      double exitPrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
      double pnl       = HistoryDealGetDouble(dealTicket, DEAL_PROFIT)
                        + HistoryDealGetDouble(dealTicket, DEAL_SWAP)
                        + HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
      datetime closeTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
      long dealDirection = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
      string direction   = (dealDirection == DEAL_TYPE_SELL) ? "BUY" : "SELL";

      double entryPrice = 0, sl = 0, tp = 0;
      datetime openTime = closeTime;

      // Chercher le deal d'entrée correspondant
      for(int j = 0; j < totalDeals; j++)
      {
         ulong dTicket = HistoryDealGetTicket(j);
         if(HistoryDealGetInteger(dTicket, DEAL_POSITION_ID) == positionId &&
            HistoryDealGetInteger(dTicket, DEAL_ENTRY) == DEAL_ENTRY_IN)
         {
            entryPrice = HistoryDealGetDouble(dTicket, DEAL_PRICE);
            openTime   = (datetime)HistoryDealGetInteger(dTicket, DEAL_TIME);
            break;
         }
      }

      if(SendClosedTrade(positionId, symbol, direction, volume,
                         entryPrice, exitPrice, sl, tp, pnl, openTime, closeTime))
      {
         syncedCount++;
      }
   }

   Print("LinhokingBridge: Historique MT5 synchronisé (", syncedCount, " trades traités).");
}

//+------------------------------------------------------------------+
//| Détecte les nouvelles positions fermées en temps réel            |
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

   SendBalance();
}

//+------------------------------------------------------------------+
int OnInit()
{
   Print("LinhokingBridge v1.20 initialisé — API: ", ApiBaseUrl);
   EventSetTimer(60);   // envoie le solde toutes les 60 secondes
   SendBalance();       // premier envoi immédiat des infos de compte et solde
   SyncHistory();       // synchronise tout l'historique passé de l'utilisateur
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
