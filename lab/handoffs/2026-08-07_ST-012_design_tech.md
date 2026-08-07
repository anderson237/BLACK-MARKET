# ST-012 — Chat commandes / précommandes (client ↔ admin)

> Auteur : Lab Director — Date : 2026-08-07
> Gate : 1 (Hypothèse/Design) → passe aux squads Implémentation

## Objectif (rappel utilisateur)
- Le client laisse un message joint à ses **précommandes** et **commandes** depuis son dashboard (`/compte`).
- L'admin voit les messages liés aux **commandes** et **précommandes confirmées**, peut y répondre.
- Le client lit les réponses (expérience "chat").
- **Badges/notifications** côté client ET côté admin à chaque mise à jour.
- Quand le client **confirme sa précommande** : les messages restent conservés.
- Une fois la commande confirmée : l'admin reçoit un **email** + une **notification dashboard admin**.

## Modèle de données (blob `bm-chat`, fichier `chat.json`)
```ts
interface ChatMessage {
  id: string
  from: 'client' | 'admin'
  text: string
  ts: number
}

interface ChatThread {
  id: string                 // 'pre:<userId>' OU 'ord:<orderId>'
  kind: 'preorder' | 'order'
  userId: string             // compte client
  orderId?: string           // pour kind='order'
  productTitle?: string      // libellé affichable (première ligne panier / commande)
  customerName?: string      // pour l'affichage admin
  messages: ChatMessage[]
  clientReadTs: number       // dernier ts lu par le CLIENT (badge client)
  adminReadTs: number        // dernier ts lu par l'ADMIN (badge admin)
  createdAt: number
  updatedAt: number
}
```
- **Thread précommande** : `pre:<userId>` — une seule conversation par utilisateur, liée à son panier (tant que non confirmé).
- **Thread commande** : `ord:<orderId>` — une conversation par commande créée.
- **Non-lus** : comptés par comparaison `msg.ts > thread.clientReadTs` (côté client, messages `from==='admin'`) et `msg.ts > thread.adminReadTs` (côté admin, messages `from==='client'`).

## Flux
1. Client connecté avec panier → onglet **Précommandes** : bouton "Discuter" → panneau chat sur `pre:<userId>`. Il écrit un message.
2. Admin → `/admin/carts` : badge non-lu par panier + panneau chat répond sur `pre:<userId>`.
3. Client confirme (1 ou toutes) → `orders.post.ts` crée la commande `ord_…`. Si un thread `pre:<userId>` existe avec des messages → **copie** des messages vers le thread `ord:<orderId>` (conservation), le thread précommande est gardé (marqué `migrated` si besoin, ou simplement conservé).
4. À la création d'une commande depuis un compte connecté → **email admin** (via Resend) + **notification dashboard** (badge admin sur `/admin/orders` = thread `ord:<orderId>` non lu).
5. Client → onglet **Commandes** : chat sur chaque `ord:<orderId>` + badge non-lu.

## APIs
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/api/chat/threads` | client | Threads du client (pre + ord) + compteurs non-lus |
| POST | `/api/chat/messages` | client | Envoyer message (cible `pre:<userId>` ou `ord:<orderId>`) |
| POST | `/api/chat/read` | client | Marquer lu (clientReadTs = now) |
| GET | `/api/admin/chat/threads` | admin | Tous les threads (pre + ord) + non-lus admin |
| POST | `/api/admin/chat/messages` | admin | Répondre (autorise pre + ord) |
| POST | `/api/admin/chat/read` | admin | Marquer lu admin (adminReadTs = now) |
| GET | `/api/admin/chat/unread-count` | admin | Nombre total de messages non lus admin (badge sidebar) |

## Email admin (à la confirmation d'une commande)
- Réutiliser le pattern Resend existant (`server/utils/reminders.ts` : `sendEmail`). Extraire un util partagé `server/utils/email.ts` (export `sendEmail`).
- Destinataire : admin (email de l'utilisateur admin ou `config.adminEmail`).
- Contenu : nouvelle commande confirmée (produit, quantité, client, WhatsApp CTA).

## Fichiers touchés
- `server/utils/storage.ts` : `loadChat`/`saveChat` (+ interface `ChatThread`).
- `server/utils/chat.ts` : helpers (upsert thread, addMessage, counts, migration pre→ord).
- `server/utils/email.ts` : util email partagé.
- `server/api/chat/*`, `server/api/admin/chat/*` : endpoints.
- `server/api/orders.post.ts` : migration des messages + email admin + notif.
- `pages/compte.vue` : chat + badges (Précommandes & Commandes).
- `pages/admin/carts.vue`, `pages/admin/orders.vue` : chat + badges.
- `layouts/admin.vue` : badge non-lus global (sidebar).
- `lab/status_board.md` : ligne ST-012.

## Critères de validation (test e2e)
1. User fictif laisse un message sur sa précommande → badge admin (Paniers) visible.
2. Admin fictif répond → badge client (Précommandes) visible, client lit la réponse.
3. Client confirme la précommande → les messages sont conservés sur la commande (chat `ord:`).
4. Admin reçoit l'email + notification dashboard (badge Commandes).
5. Admin répond sur la commande → client lit (badge Commandes client).
