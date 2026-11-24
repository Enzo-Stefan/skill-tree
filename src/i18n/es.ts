import type { Strings } from "./en";

/**
 * Every piece of app text in Spanish: neutral Spanish with "tú", like the skill content in src/data/es/.
 * First draft: a fluent speaker should check it before players see it.
 */

/** "A" or "A y B". */
function listAnd(items: string[]): string {
  return items.join(" y ");
}

export const es: Strings = {
  app: {
    train: "Entrenar",
    showingTargets: (rung: string) => `Mostrando objetivos de ${rung}.`,
    newRank: (rank: string) => `Nuevo rango: ${rank}.`,
    skillCompleteUnlocked: (skill: string, unlocked: string[]) =>
      `${skill} completada. Desbloqueadas: ${unlocked.join(", ")}.`,
    skillComplete: (skill: string) => `${skill} completada.`,
    copied: "Progreso copiado. Pégalo donde quieras.",
    copyFailed: "No se pudo copiar en este navegador.",
    resetDone: "Se ha borrado todo el progreso de este árbol.",
    accountDeleted: "Tu cuenta y su progreso guardado se han borrado.",
    undo: "Deshacer",
    undoPass: (skill: string) => `Deshacer el aprobado de ${skill}`,
    undone: (skill: string) => `${skill} vuelve a estar lista para entrenar.`,
    cancel: "Cancelar",
    skipForNow: "Ahora no",
  },
  tabs: {
    label: "Principal",
    brand: "hapi skill",
    train: "Entrenar",
    progress: "Progreso",
    settings: "Ajustes",
  },
  lifts: {
    title: "Tus pesos",
    best: "Récord personal",
    /** A logged day, e.g. "3 nov", with the year only when it isn't this year. */
    on: (date: string) => {
      const d = new Date(`${date}T12:00:00`);
      const thisYear = d.getFullYear() === new Date().getFullYear();
      return d.toLocaleDateString("es-ES", thisYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
    },
    empty: "Apunta el peso que usas cada vez que haces este ejercicio y aquí verás tu récord personal.",
    inputLabel: "Peso que usaste hoy",
    log: "Guardar",
    invalid: "Escribe un peso de 0 a 500 kg, por ejemplo 62,5.",
    newBest: (kg: string) => `¡Nuevo récord personal: ${kg}!`,
    logged: (kg: string) => `Guardado: ${kg}.`,
    undo: "Deshacer",
    recent: "Últimos pesos",
    bestsTitle: "Récords personales",
    bestsEmpty: "Apunta un peso en cualquier ejercicio de este árbol y aquí verás tus récords.",
    upFrom: (kg: string, times: number) => `Antes: ${kg} · ${times} ${times === 1 ? "registro" : "registros"}`,
    timesLogged: (times: number) => `${times} ${times === 1 ? "registro" : "registros"}`,
  },
  progressScreen: {
    rankLabel: "Tu rango",
    level: "Nivel",
    thisWeek: "Esta semana",
    streak: "Racha",
  },
  settings: {
    training: "Entrenamiento",
    yourLevel: "Tu nivel",
    pickLevel: "Elegir",
    account: "Cuenta",
    signIn: "Iniciar sesión con Google",
    signInSub: "Guarda tu progreso en todos tus dispositivos",
    progress: "Progreso",
    reset: "Borrar todo",
    resetSub: (tree: string) => `Borra todo tu progreso de ${tree}`,
    language: "Idioma",
    phoneLanguage: "El de tu teléfono",
    about: "Información",
    privacy: "Política de privacidad",
    privacySub: "Qué guardamos y cómo borrarlo",
    followsPhone: "El modo claro u oscuro sigue el ajuste de tu teléfono.",
  },
  header: {
    skillsCount: (done: number, total: number) => `${done} de ${total} habilidades`,
    moreToReach: (left: number, rank: string) => `${left} más para llegar a ${rank}`,
    allUnlocked: "Todas las habilidades desbloqueadas.",
    level: (name: string | null) => `Nivel: ${name ?? "Elegir"}`,
    share: "Compartir mi árbol",
    copy: "Copiar mi progreso",
    resetConfirm: "Toca otra vez para borrarlo todo",
    privacy: "Privacidad",
  },
  treeSwitch: {
    label: "Árbol de habilidades",
  },
  branchTabs: {
    label: "Ramas",
  },
  tree: {
    startTile: "YA",
    finalTile: "90'",
    nodeLabel: (skill: string, status: string, next: boolean) => `${skill}, ${status}${next ? ", la siguiente" : ""}`,
    passed: "Aprobada",
    after: (skills: string[]) =>
      skills.length > 2 ? `Después de ${skills.length} habilidades más` : `Después de ${listAnd(skills)}`,
    branchCount: (done: number, total: number) => `${done} de ${total} hechas`,
    nextUp: "La siguiente",
  },
  nextUp: {
    start: "Empieza aquí. Todas las ramas se abren después.",
    leastDone: (branch: string) => `${branch}: la rama que menos has hecho`,
    goodNextStep: (branch: string) => `Un buen siguiente paso en ${branch}`,
    final: "La habilidad final",
  },
  panel: {
    status: { done: "Completada", available: "Lista para entrenar", locked: "Bloqueada" },
    startHere: "Empieza aquí",
    finalSkill: "Habilidad final",
    close: "Cerrar",
    closeLabel: "Cerrar los detalles de la habilidad",
    finishFirst: (skills: string[]) => `Termina primero: ${skills.join(", ")}.`,
    drill: "El ejercicio",
    test: "Supera la prueba",
    target: (rung: string) => `Objetivo de ${rung}`,
    changeLevel: "Cambiar nivel",
    pickLevelForTarget: "Elige tu nivel para ver tu objetivo",
    tip: "Consejo del entrenador",
    youtubeSearch: (treeId: string, skill: string) =>
      treeId === "football"
        ? `${skill} fútbol ejercicio tutorial`
        : treeId === "weights"
          ? `${skill} técnica ejercicio tutorial`
          : `${skill} tutorial`,
    watchYoutube: "Ver tutoriales en YouTube",
    passed: "He superado la prueba",
    undoFirst: (skills: string[]) => `Para deshacer esto, primero deshaz: ${skills.join(", ")}.`,
    undo: "Deshacer",
  },
  testMode: {
    open: "Empezar prueba",
    openHint: "Cuenta o cronometra la prueba por ti en el campo.",
    title: (skill: string) => `Prueba: ${skill}`,
    close: "Cerrar",
    side: (n: number, total: number) => `Lado ${n} de ${total}`,
    goalHits: (needed: number, attempts: number) => `Consigue ${needed} de ${attempts}.`,
    goalCount: (needed: number, inARow: boolean) => (inARow ? `${needed} seguidos.` : `${needed} en total.`),
    goalCountTimed: (needed: number, time: string) => `${needed} en ${time}.`,
    goalTime: (time: string) => `En menos de ${time}.`,
    goalTimeNoLimit: "Elige tu nivel para tener un tiempo objetivo.",
    goalHold: (time: string) => `Aguanta ${time}.`,
    /** A length of time in words, for the goal line: "60 segundos", "25 minutos", "1 min 30 s". */
    duration: (s: number) =>
      s < 60 ? `${s} segundos` : s % 60 === 0 ? `${s / 60} minutos` : `${Math.floor(s / 60)} min ${s % 60} s`,
    bestOf: (n: number) => `El mejor de ${n} intentos.`,
    everyRun: (n: number) => `${n} intentos, todos por debajo del tiempo.`,
    eachTry: (seconds: number) =>
      `Cada intento dura ${seconds} segundos. Toca Empezar intento en cada uno, y Fallo si sale mal. Si aguantas todo el tiempo, cuenta como acierto.`,
    hitsFrom: (tries: number) => `aciertos de ${tries} ${tries === 1 ? "intento" : "intentos"}`,
    countOf: (needed: number) => `de ${needed}`,
    hitsLeft: (left: number) => `${left === 1 ? "Queda" : "Quedan"} ${left} ${left === 1 ? "intento" : "intentos"}`,
    hit: "Acierto",
    miss: "Fallo",
    add: "+1",
    addLabel: "Sumar uno",
    slip: "Fallo: vuelve a 0",
    start: "Empezar",
    startTry: "Empezar intento",
    stop: "Parar",
    giveUp: "Parar antes",
    undoTap: "Deshacer el último toque",
    restart: "Empezar de nuevo",
    nextSide: "Empezar el otro lado",
    run: (n: number, total: number) => `Intento ${n} de ${total}`,
    times: "Tus tiempos",
    passed: "¡Prueba superada!",
    sideDone: "¡Primer lado hecho!",
    failed: "Esta vez no. Inténtalo otra vez.",
    finished: "Hecho. Elige tu nivel para ver si estos tiempos superan la prueba.",
    markPassed: "Marcar la habilidad como superada",
    alreadyPassed: "Ya has superado esta habilidad.",
    seconds: (value: number) => `${value} s`,
    saveTime: (time: string) => `Guardar mi tiempo: ${time}`,
    saved: (time: string) => `Guardado: ${time}.`,
    newBest: (time: string) => `¡Nuevo mejor tiempo: ${time}!`,
    undoSave: "Deshacer",
    bestTime: "Tu mejor tiempo",
  },
  video: {
    offlineTitle: "El vídeo necesita internet",
    offlineBody: "El ejercicio, la prueba y el consejo funcionan sin conexión.",
    label: (skill: string) => `Vídeo de ${skill}`,
    play: (skill: string) => `Reproducir el vídeo de ${skill}`,
    playNote: "Toca para reproducir. El vídeo se carga desde YouTube.",
  },
  practice: {
    label: "Entrenamiento de esta semana",
    thisWeek: "Esta semana:",
    days: (done: number, goal: number) => `${done} de ${goal}`,
    trainingDays: "días de entrenamiento",
    streak: "Racha:",
    weeks: (n: number) => `${n} ${n === 1 ? "semana" : "semanas"}`,
    trained: "Hoy he entrenado ✓ (toca para deshacer)",
    train: "Hoy he entrenado",
  },
  levelUp: {
    label: "Pregunta para subir de nivel",
    trainedFor: (days: number, weeks: number) =>
      `Has entrenado al menos ${days} días por semana durante ${weeks} semanas.`,
    improved: "¿Crees que has mejorado?",
    yes: "Sí",
    notYet: "Todavía no",
  },
  levelPicker: {
    title: "¿Cuál es tu nivel?",
    lockedIntro: (days: number, weeks: number) =>
      `Puedes bajar de nivel cuando quieras. Para subir, entrena ${days} días por semana durante ${weeks} semanas y supera la prueba.`,
    intro: "Algunas pruebas tienen un objetivo distinto para cada nivel. Solo verás el tuyo. El nivel más fácil está abierto a todos. Para uno más alto, primero superas su prueba.",
    lockedHint: "Supera la prueba para subir",
  },
  levelTest: {
    title: (rung: string) => `Prueba de ${rung}`,
    intro: (rung: string) => `Haz esto con los objetivos de ${rung}. Si lo superas todo, subes a ${rung}.`,
    passed: "Lo he superado",
    notYet: "Todavía no",
    placementIntro: (rung: string) =>
      `Para empezar en ${rung}, haz esto con sus objetivos. Si lo superas todo, empiezas ahí.`,
    pickAnother: "Elegir otro nivel",
  },
  share: {
    title: "Compartir mi árbol",
    imageAlt: (rank: string, done: number, total: number) => `${rank}: ${done} de ${total} habilidades`,
    drawing: "Dibujando…",
    share: "Compartir",
    download: "Descargar",
    close: "Cerrar",
    shareText: (done: number, total: number, title: string) => `${done} de ${total} habilidades en ${title}.`,
    shareFailed: "Aquí no se pudo compartir. Prueba con Descargar.",
    imageFailed: "No se pudo crear la imagen.",
    cantDraw: "Este navegador no puede dibujar imágenes.",
    imageSkills: (done: number, total: number) => `${done} de ${total} habilidades`,
    imageStreak: (weeks: number) => ` · racha de ${weeks} ${weeks === 1 ? "semana" : "semanas"}`,
    imageTraining: (rung: string, streak: string) => `Entrenando en ${rung}${streak}`,
  },
  account: {
    signOut: "Cerrar sesión",
    signedInFallback: "Sesión iniciada",
  },
  signIn: {
    title: "Iniciar sesión",
    body: "Inicia sesión para guardar tu progreso en todos tus dispositivos. La app también funciona sin cuenta.",
    opening: "Abriendo Google…",
    google: "Continuar con Google",
    notNow: "Ahora no",
    privacy: "Qué guardamos y cómo borrarlo",
    notSetUp: "Las cuentas todavía no están listas.",
    loadFailed: "No se pudo cargar el inicio de sesión. Revisa tu conexión y vuelve a intentarlo.",
  },
  accountDialog: {
    title: "Tu cuenta",
    confirmTitle: "¿Borrar tu cuenta?",
    confirmBody: "Esto borra tu cuenta y el progreso guardado en ella, en todos tus dispositivos. No se puede deshacer.",
    browserStays:
      "El progreso guardado en este navegador se queda aquí. Para borrarlo también, usa Borrar todo en Ajustes en cada árbol.",
    signedInAs: "Has iniciado sesión con Google como",
    deleting: "Borrando…",
    deleteForGood: "Borrar para siempre",
    cancel: "Cancelar",
    delete: "Borrar cuenta",
    close: "Cerrar",
    deleteFailed: "No se pudo borrar tu cuenta. Vuelve a intentarlo o escríbenos (mira la página de privacidad).",
    unreachable: "No se pudo conectar con el servidor. Revisa tu conexión y vuelve a intentarlo.",
  },
  sync: {
    signedIn: "Sesión iniciada. Tu progreso se guarda en tu cuenta.",
    saveFailed: "No se pudo guardar en tu cuenta. Tu progreso sigue guardado en este dispositivo.",
    loadFailed: "No se pudo conectar con tu cuenta. Tu progreso sigue guardado en este dispositivo.",
  },
  summary: {
    headline: (title: string, done: number, total: number, rank: string) => `Mi ${title}: ${done}/${total} habilidades, rango ${rank}.`,
    training: (rung: string) => ` Entreno en ${rung}.`,
  },
};
