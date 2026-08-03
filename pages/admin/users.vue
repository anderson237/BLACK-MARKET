<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const store = useAdminStore()
const error = ref('')
const savedMsg = ref('')
const newEmail = ref('')
const saving = ref(false)

const data = computed(() => store.users)
const isOwner = computed(() => !!data.value?.currentEmail && data.value?.currentEmail === data.value?.owner)

onMounted(() => store.loadUsers())

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

async function promote(email: string) {
  if (!data.value || !isOwner.value || saving.value) return
  saving.value = true
  savedMsg.value = ''
  error.value = ''
  try {
    const next = await store.saveAdmins([...store.admins, email])
    savedMsg.value = `« ${email} » est désormais administrateur.`
  } catch (e: any) {
    error.value = e?.message || 'Erreur lors de la promotion.'
  } finally {
    saving.value = false
  }
}

async function demote(email: string) {
  if (!data.value || !isOwner.value || email === data.value.owner || saving.value) return
  saving.value = true
  savedMsg.value = ''
  error.value = ''
  try {
    const next = await store.saveAdmins(store.admins.filter((a) => a !== email))
    savedMsg.value = `« ${email} » n'est plus administrateur.`
  } catch (e: any) {
    error.value = e?.message || 'Erreur lors de la rétrogradation.'
  } finally {
    saving.value = false
  }
}

async function addByEmail() {
  if (!data.value || !isOwner.value || saving.value) return
  const email = newEmail.value.trim().toLowerCase()
  if (!email || store.admins.includes(email)) {
    newEmail.value = ''
    return
  }
  saving.value = true
  savedMsg.value = ''
  error.value = ''
  try {
    await store.saveAdmins([...store.admins, email])
    newEmail.value = ''
    savedMsg.value = `« ${email} » ajouté comme administrateur (connexion Google autorisée).`
  } catch (e: any) {
    error.value = e?.message || "Erreur lors de l'ajout."
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Banner -->
    <div class="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h3 class="text-base font-extrabold text-white font-mono uppercase tracking-wider flex items-center gap-2">
          <AppIcon name="users" :size="18" class="text-[#ff2a2a]" /> GESTION DES UTILISATEURS
        </h3>
        <p class="text-[10px] font-mono text-zinc-500 mt-1">
          {{ isOwner
            ? 'Propriétaire — vous pouvez promouvoir ou rétrograder les administrateurs.'
            : (data?.currentEmail ? 'Connecté en tant qu\'administrateur (lecture seule).' : 'Connecté via mot de passe (lecture seule).') }}
        </p>
      </div>
      <button
        @click="store.loadUsers()"
        class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-zinc-300 bg-black border border-zinc-800 hover:border-[#ff2a2a]/40 transition-all"
      >
        ⟳ RAFRAÎCHIR
      </button>
    </div>

    <div v-if="savedMsg" class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl px-4 py-3 text-xs font-mono">{{ savedMsg }}</div>
    <div v-if="error" class="bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl px-4 py-3 text-xs font-mono">{{ error }}</div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Connexions Google -->
      <div class="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 space-y-4">
        <div>
          <h4 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <AppIcon name="refresh" :size="14" class="text-zinc-500" /> CONNEXIONS GOOGLE
          </h4>
          <p class="text-[10px] font-mono text-zinc-500">Comptes Gmail qui se sont connectés</p>
        </div>

        <div class="space-y-2">
          <div v-if="!data?.logins?.length" class="py-8 text-center text-xs font-mono text-zinc-500">Aucune connexion Google enregistrée.</div>
          <div v-for="u in data?.logins || []" :key="u.email" class="flex items-center gap-3 bg-black/40 border border-zinc-900 rounded-xl px-3 py-2.5">
            <img v-if="u.picture" :src="u.picture" alt="" class="w-9 h-9 rounded-full object-cover bg-zinc-900 border border-zinc-800" />
            <div v-else class="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff2a2a] to-[#900] flex items-center justify-center text-white text-xs font-mono font-bold">
              {{ String(u.email || '?').slice(0, 1).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-mono text-slate-200 flex items-center gap-1.5 truncate">
                <span class="truncate">{{ u.name }}</span>
                <span v-if="u.email === data?.owner" title="Propriétaire"><AppIcon name="crown" :size="13" class="text-yellow-400" /></span>
                <span v-if="store.admins.includes(u.email) && u.email !== data?.owner" title="Administrateur"><AppIcon name="settings" :size="13" class="text-[#ff2a2a]" /></span>
              </div>
              <div class="text-[9px] font-mono text-zinc-500 truncate">{{ u.email }}</div>
              <div class="text-[9px] font-mono text-zinc-600">Dernière connexion : {{ formatDate(u.loggedInAt) }}</div>
            </div>
            <span v-if="u.email === data?.owner" class="text-[8px] font-mono font-bold uppercase text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-1 rounded-full shrink-0">Propriétaire</span>
            <button
              v-else-if="store.admins.includes(u.email)"
              @click="demote(u.email)"
              :disabled="!isOwner || saving"
              class="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-1 rounded-lg text-red-400 border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 disabled:opacity-30 transition-all"
            >
              Rétrograder
            </button>
            <button
              v-else
              @click="promote(u.email)"
              :disabled="!isOwner || saving"
              class="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-1 rounded-lg text-[#ff2a2a] border border-[#ff2a2a]/30 bg-[#ff2a2a]/5 hover:bg-[#ff2a2a]/15 disabled:opacity-30 transition-all"
            >
              Promouvoir
            </button>
          </div>
        </div>
      </div>

      <!-- Admins + add -->
      <div class="space-y-6">
        <div class="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 space-y-4">
          <div>
            <h4 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <AppIcon name="crown" :size="15" class="text-yellow-400" /> ADMINISTRATEURS
            </h4>
            <p class="text-[10px] font-mono text-zinc-500">Ces comptes Gmail peuvent se connecter au panneau</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="a in store.admins"
              :key="a"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border"
              :class="a === data?.owner ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-[#ff2a2a]/10 border-[#ff2a2a]/25 text-[#ff2a2a]'"
            >
              {{ a === data?.owner ? '👑' : '🛡️' }} {{ a }}
            </span>
          </div>
        </div>

        <div class="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 space-y-4">
          <div>
            <h4 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              ＋ AJOUTER PAR EMAIL
            </h4>
            <p class="text-[10px] font-mono text-zinc-500">Autoriser un compte Gmail à accéder au panneau</p>
          </div>
          <div v-if="!isOwner" class="text-[11px] font-mono text-zinc-500 bg-black/40 border border-zinc-900 rounded-xl px-3 py-2.5">
            Seul le propriétaire ({{ data?.owner }}) peut ajouter des administrateurs.
          </div>
          <form v-else class="flex items-center gap-2" @submit.prevent="addByEmail">
            <input
              v-model="newEmail"
              type="email"
              placeholder="prenom@gmail.com"
              class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600"
            />
            <button
              type="submit"
              :disabled="saving || !newEmail.trim()"
              class="bg-[#ff2a2a] hover:bg-red-600 disabled:opacity-30 text-white text-xs font-mono font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all"
            >
              AJOUTER
            </button>
          </form>
          <p class="text-[9px] font-mono text-zinc-600 leading-relaxed">
            L'email ajouté pourra ensuite se connecter avec « Se connecter avec Google » sur l'écran de connexion. Toute personne connectée apparaît dans la liste des connexions ci-contre.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
