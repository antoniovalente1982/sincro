import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const updates = [
  { trigger_keyword: 'gap', headline_white: 'Il Gap Si Allarga Ogni Giorno.', headline_gold: 'Fermalo Ora.', subtitle: 'Più aspetti, più la distanza tra il suo potenziale e i risultati cresce. <strong>Il Metodo Sincro® chiude il gap</strong> trasformando la mentalità in 90 giorni.' },
  { trigger_keyword: 'talento', headline_white: 'Non Lasciare Che Il Suo Talento', headline_gold: 'Venga Sprecato.', subtitle: 'Vedi altri ragazzi meno dotati superarlo solo perché hanno <strong>più grinta e meno paura</strong>? Il talento da solo non basta. Il Metodo Sincro® lo trasforma in <strong>mentalità vincente</strong>.' },
  { trigger_keyword: 'pressione', headline_white: 'La Pressione Lo Sta Schiacciando?', headline_gold: 'Ecco La Soluzione.', subtitle: 'In partita si spegne, <strong>sbaglia le cose facili</strong> e perde fiducia. Il Metodo Sincro® insegna ai giovani calciatori ad usare la pressione come <strong>carburante, non come freno</strong>.' },
  { trigger_keyword: 'potenziale', headline_white: 'Sblocca Il Suo Vero Potenziale', headline_gold: 'In Soli 90 Giorni.', subtitle: 'Ha talento — lo vedi ogni giorno. Ma sta giocando <strong>al 30% delle sue capacità</strong>. Il Metodo Sincro® è l\'unico percorso in Italia che <strong>garantisce risultati per contratto</strong>.' },
  { trigger_keyword: 'efficiency', headline_white: 'Stesso Ragazzo. Stessa Tecnica.', headline_gold: 'Risultati Opposti.', subtitle: 'Ogni giorno che passa, <strong>il gap tra il suo talento e i suoi risultati si allarga</strong>. Il Metodo Sincro® trasforma la mentalità del tuo figlio e sblocca il suo <strong>potenziale nascosto</strong> in soli 90 giorni.' },
  { trigger_keyword: 'emotional', headline_white: 'In Allenamento È Un Altro.', headline_gold: 'In Partita Si Spegne.', subtitle: 'Ha il talento. Ma qualcosa <strong>lo blocca ogni volta</strong>. Non è un problema tecnico — è una questione di <strong>approccio mentale</strong>. E con il percorso giusto, si risolve in 90 giorni.' },
  { trigger_keyword: 'system', headline_white: 'Mentalità Vincente: Non Si Nasce,', headline_gold: 'Si Diventa. Col Giusto Metodo.', subtitle: 'Non lasciare la crescita del tuo figlio al caso o all\'ambiente sbagliato. Il Metodo Sincro® fornisce <strong>gli strumenti mentali</strong> usati dai professionisti per <strong>performare sotto pressione</strong> e trasformare i blocchi in sicurezza.' },
  { trigger_keyword: 'status', headline_white: 'Unisciti All\'Elite.', headline_gold: 'Il Percorso Che Trasforma I Campioni.', subtitle: 'Migliaia di atleti si perdono per strada. <strong>Solo chi domina la propria mente</strong> arriva in alto. Questo è il programma avanzato scelto da <strong>decine di atleti che oggi giocano tra i Professionisti</strong>.' },
  { trigger_keyword: 'education', headline_white: 'Perché Il 90% Dei Giovani Calciatori', headline_gold: 'Si Perde Prima Dei 18 Anni?', subtitle: 'Non è la mancanza di tecnica. È <strong>l\'incapacità di gestire la pressione</strong>, l\'ansia e il giudizio. Scopri come il Metodo Sincro® costruisce una <strong>corazza mentale</strong> indistruttibile in 90 giorni.' },
  { trigger_keyword: 'growth', headline_white: 'Da Bloccato e Insicuro', headline_gold: 'A Leader In Campo In 90 Giorni.', subtitle: 'Vostro figlio ha le qualità. Ma <strong>la paura e l\'insicurezza</strong> lo frenano. Il Metodo Sincro® è il percorso che ha già trasformato <strong>1.100 giovani calciatori</strong>. Il percorso formativo mentale N°1 in Italia.' },
  { trigger_keyword: 'authority', headline_white: 'Il Primo Programma In Italia', headline_gold: 'Con Coach Sportivi CONI Certificati.', subtitle: 'Non affidate la mente del tuo figlio a "motivatori" improvvisati. Scegli un pool di <strong>psicologi dello sport e coach certificati</strong> dedicati a <strong>settori giovanili e atleti professionisti</strong>.' },
  { trigger_keyword: 'security', headline_white: 'Otteniamo Il Risultato', headline_gold: 'Oppure Sei Rimborsato al 100%. È Matematico.', subtitle: 'L\'unico percorso per atleti giovani con la <strong>Garanzia Sincro™</strong>. Eliminiamo ansia e blocchi o <strong>l\'intero programma è gratuito</strong>. Non rischi nulla, ma puoi salvare la sua carriera.' },
  { trigger_keyword: 'trauma', headline_white: 'Ti Fa Male Vederlo Così, Vero?', headline_gold: 'Sappiamo Come Farlo Tornare A Sorridere.', subtitle: 'Ogni settimana che aspetti, il suo autostima scende un po\'. <strong>Smetti di guardare soffrendo</strong> la sua insicurezza. Il nostro team sa <strong>esattamente come riportarlo in campo</strong> con il sorriso che merita.' },
  { trigger_keyword: 'decision', headline_white: 'Decine di Video-Testimonianze.', headline_gold: 'Zero Promesse, Solo Fatti.', subtitle: 'Guarda i risultati di chi ci è passato nella <strong>vostra stessa situazione</strong>. 90 giorni sono tutto ciò che serve per <strong>sbloccare la mente</strong> e cambiare i risultati in pagella e sul tabellino.' },
  { trigger_keyword: 'sport_performance', headline_white: 'Il Lato Nascosto del Calcio:', headline_gold: 'La Mente Comanda I Muscoli.', subtitle: 'Gli allenamenti sul campo non bastano più quando <strong>il blocco è nella testa</strong>. Impara le tecniche di <strong>performance-psychology</strong> per massimizzare tempo di reazione e lettura tattica sotto stress.' }
]

async function run() {
  let ok = 0, fail = 0
  for (const u of updates) {
    const { error } = await sb.from('funnel_routing_engine').update({
      headline_white: u.headline_white.trim(),
      headline_gold: u.headline_gold.trim(),
      subtitle: u.subtitle.trim()
    }).eq('trigger_keyword', u.trigger_keyword)
    
    if (error) { 
      console.error(`❌ ${u.trigger_keyword}:`, error.message)
      fail++ 
    }
    else { 
      console.log(`✅ ${u.trigger_keyword}`)
      ok++ 
    }
  }
  console.log(`\nDone: ${ok} updated, ${fail} failed`)
}

run()
