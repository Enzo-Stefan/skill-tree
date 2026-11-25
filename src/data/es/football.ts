import type { TreeTranslation } from "../../lib/translate";
import { footballRoutinesEs } from "./routines-football";

// Spanish for the football tree. A FIRST DRAFT: someone fluent should check it, especially the
// football terms, before the app shows it to players (#19). Numbers stay exactly as in English,
// so the level targets and test checks still match.

const footballContent: TreeTranslation = {
  title: "hapi skill",
  shortName: "Fútbol",
  tagline: "Toca una habilidad, supera su prueba y desbloquea la siguiente.",
  branches: {
    bc: "Control",
    ps: "Pase",
    dr: "Regate",
    sh: "Tiro",
    df: "Defensa",
    ft: "Físico",
  },
  levels: ["Liga de barrio", "Cantera", "Semiprofesional", "Profesional", "Primer equipo", "Leyenda"],
  playerLevels: {
    beginner: { name: "Principiante", hint: "Nuevo en el fútbol o empezando a entrenar" },
    intermediate: { name: "Intermedio", hint: "Juegas a menudo en un equipo del colegio o del barrio" },
    advanced: { name: "Avanzado", hint: "Juegas en un club de alto nivel o en una cantera" },
    expert: { name: "Experto", hint: "Nivel semiprofesional o superior" },
  },
  skills: {
    root: {
      name: "Primer control",
      drill: "Pide a un amigo que te ruede el balón desde 10 metros, o pásalo contra una pared. Páralo con el interior del pie para que quede cerca.",
      test: "Para 10 pases rasos seguidos. Cada uno debe quedar a menos de un paso de ti.",
      tip: "Retira un poco el pie cuando llega el balón. Un pie suave lo frena. Un pie rígido lo hace rebotar.",
    },
    bc1: {
      name: "20 toques seguidos",
      drill: "Deja caer el balón sobre tu pie bueno y mantenlo en el aire con el empeine. Al principio puedes dejar que bote una vez entre toques.",
      test: "20 toques seguidos, solo con los pies, sin botes.",
      tip: "Tobillo firme y la punta del pie un poco hacia arriba. Los toques pequeños, a la altura de la cintura, son más fáciles.",
    },
    bc2: {
      name: "Controlar balones altos",
      drill: "Un compañero te lanza el balón desde 10 metros. Contrólalo con el muslo, el pecho o el pie y déjalo en el suelo.",
      test: "Controla 8 de 10 lanzamientos para que el balón caiga a menos de un paso de ti.",
      tip: "Relaja la parte del cuerpo donde da el balón, como si atraparas un huevo.",
    },
    bc3: {
      name: "50 toques, ambos pies",
      drill: "Haz toques cambiando de pie en cada uno. Después añade muslos y cabeza.",
      test: "50 toques seguidos, usando cada pie al menos 15 veces.",
      tip: "Cuenta en voz alta. Te ayuda a mantener el ritmo.",
    },
    bc4: {
      name: "Control orientado",
      drill: "Pon un cono detrás de ti como si fuera un defensa. Recibe un pase y usa el primer toque para llevar el balón lejos del cono, hacia el espacio.",
      test: "8 de 10 primeros toques llevan el balón al menos 2 metros hacia el espacio, lejos del cono.",
      tip: "Mira por encima del hombro antes de que llegue el balón para saber dónde está el espacio.",
    },
    bc5: {
      name: "Proteger el balón",
      drill: "Ponte de espaldas a un compañero. Mantén el balón bajo la suela mientras intenta quitártelo.",
      test: "Aguanta el balón 10 segundos en 4 de 5 rondas.",
      tip: "Rodillas flexionadas, brazo extendido y el cuerpo entre el defensa y el balón.",
    },
    ps1: {
      name: "Pase con el interior",
      drill: "Marca en una pared una zona del ancho de un balón. Pasa hacia ella desde 10 metros con tu pie bueno.",
      test: "8 de 10 pases dan en la zona desde 10 metros.",
      tip: "Apoya el pie de apoyo junto al balón, apuntando al objetivo.",
    },
    ps2: {
      name: "Pase con el pie débil",
      drill: "El mismo ejercicio contra la pared, solo con el pie débil. Haz 50 al día durante una semana.",
      test: "7 de 10 pases con el pie débil dan en la zona desde 10 metros.",
      tip: "Ve despacio. Primero precisión, la fuerza ya llegará.",
    },
    ps3: {
      name: "Paredes a un toque",
      drill: "Colócate a 5 metros de una pared. Devuelve cada rebote de primeras, alternando los pies.",
      test: "40 pases limpios a un toque en 60 segundos, sin que el balón se pare.",
      tip: "Mantente sobre las puntas de los pies para estar listo ante un mal bote.",
    },
    ps4: {
      name: "Pase tenso de 30 m",
      drill: "Golpea el centro del balón con el empeine para que viaje raso y rápido hasta un compañero a 30 metros.",
      test: "6 de 10 pases llegan a tu compañero sin pasar de la altura de la cabeza.",
      tip: "Inclínate sobre el balón y cae sobre el pie de golpeo después del pase.",
    },
    ps5: {
      name: "Cambio de juego 40 m",
      drill: "Lanza pases altos de lado a lado del campo a un compañero dentro de un cuadrado de 5 metros.",
      test: "5 de 10 pases caen en el cuadrado desde 40 metros.",
      tip: "Golpea por debajo del centro del balón e inclínate un poco hacia atrás.",
    },
    dr1: {
      name: "Eslalon entre conos",
      drill: "Pon 6 conos en fila, a 1 metro de distancia. Pasa entre ellos y vuelve usando los dos pies.",
      test: "Ida y vuelta en menos de 15 segundos sin tocar ningún cono.",
      tip: "Toca el balón en cada paso. Más toques significa más control.",
    },
    dr2: {
      name: "Interior y exterior",
      drill: "Conduce en zigzag, cortando el balón con el interior del pie y luego con el exterior del mismo pie.",
      test: "Completa el eslalon usando un solo pie en menos de 18 segundos, y repítelo con el otro pie.",
      tip: "Baja la cadera al cortar. El cambio de dirección sale más rápido.",
    },
    dr3: {
      name: "Bicicleta",
      drill: "Corre hacia un cono, pasa el pie alrededor del balón y sal con el balón hacia el otro lado.",
      test: "8 de 10 bicicletas a velocidad de carrera, superando el cono por el lado correcto.",
      tip: "Engaña con los hombros. Los defensas miran tu cadera, no tus pies.",
    },
    dr4: {
      name: "Cruyff y arrastre",
      drill: "Conduce hacia un cono. Amaga un pase y arrastra el balón por detrás de tu pierna de apoyo para girarte.",
      test: "8 de 10 giros limpios trotando, con los dos pies.",
      tip: "El amago de pase tiene que parecer real. Mueve la pierna con decisión.",
    },
    dr5: {
      name: "Gana el 1 contra 1",
      drill: "Juega 1 contra 1 con un compañero en un cuadrado de 10 por 15 metros. Marcas si cruzas su línea de fondo con el balón.",
      test: "Gana 5 de 10 duelos de uno contra uno.",
      tip: "Ataca el pie adelantado del defensa. Tendrá que girarse para pararte.",
    },
    sh1: {
      name: "Definición colocada",
      drill: "Marca las dos esquinas inferiores de una portería. Tira con el interior hacia ellas desde el punto de penalti.",
      test: "7 de 10 tiros entran en una zona de esquina desde 12 metros.",
      tip: "Elige la esquina antes de tirar y no cambies de idea.",
    },
    sh2: {
      name: "Disparo con el empeine",
      drill: "Dispara con el empeine desde el borde del área, buscando potencia y que el tiro vaya bajo.",
      test: "6 de 10 tiros a puerta desde 18 metros.",
      tip: "Cabeza sobre el balón, punta del pie hacia abajo y acompaña el golpeo hacia la portería.",
    },
    sh3: {
      name: "Definir con pie débil",
      drill: "Repite el ejercicio de definición colocada solo con el pie débil.",
      test: "6 de 10 tiros con el pie débil entran en una zona de esquina desde 12 metros.",
      tip: "Casi todos los porteros esperan tu pie bueno. Un buen pie débil gana partidos.",
    },
    sh4: {
      name: "Definir de primera",
      drill: "Un compañero te pasa el balón raso desde un lado. Dispara de primeras, sin controlarlo.",
      test: "6 de 10 tiros de primeras a puerta desde 12 metros.",
      tip: "Abre el cuerpo hacia la portería antes de que llegue el balón.",
    },
    sh5: {
      name: "Volea",
      drill: "Un compañero te lanza el balón por alto desde 5 metros. Golpéalo de volea a portería antes de que bote.",
      test: "5 de 10 voleas a puerta desde 12 metros.",
      tip: "Mira el balón hasta que toque el pie y mantén la rodilla por encima de él.",
    },
    df1: {
      name: "Posición defensiva",
      drill: "Ponte de perfil, rodillas flexionadas y el peso en las puntas. Desplázate hacia atrás y de lado sin cruzar los pies.",
      test: "Retrocede 10 metros en zigzag y vuelve sin cruzar los pies ni una vez.",
      tip: "Lleva al atacante hacia la banda, lejos de la portería.",
    },
    df2: {
      name: "Temporizar y frenar",
      drill: "Un compañero intenta pasar regateando una línea. Tu único trabajo es frenarlo.",
      test: "Impide que el atacante cruce la línea durante 6 segundos, 7 de 10 veces.",
      tip: "Quédate a un brazo de distancia. Si te acercas demasiado, te supera.",
    },
    df4: {
      name: "Despeje de cabeza",
      drill: "Un compañero te lanza el balón alto. Despéjalo hacia arriba y lejos con la frente. Haz como mucho 10 cabezazos por sesión y usa un balón más ligero mientras aprendes.",
      test: "Despeja de cabeza 8 de 10 lanzamientos a 10 metros o más.",
      tip: "Ojos abiertos, cuello firme y ve a por el balón en lugar de esperarlo.",
    },
    df3: {
      name: "Entrada limpia",
      drill: "Practica entradas de bloqueo contra un compañero que conduce caminando y después trotando.",
      test: "Recupera el balón limpiamente 6 de 10 veces sin hacer falta.",
      tip: "Entra con el interior del pie y pon todo el peso del cuerpo en la entrada.",
    },
    df5: {
      name: "Leer e interceptar",
      drill: "Juega un 3 contra 1 en un cuadrado de 10 por 10 metros. Tú eres el 1. Intenta anticiparte y cortar los pases.",
      test: "Intercepta 5 pases en 2 minutos.",
      tip: "Mira la cadera de quien pasa. Apunta hacia donde va el balón.",
    },
    ft1: {
      name: "Correr 3 km",
      drill: "Corre a ritmo suave 3 veces por semana. Empieza con 1 km y ve subiendo.",
      test: "Corre 3 km sin parar.",
      tip: "Si no puedes hablar mientras corres, vas demasiado rápido.",
    },
    ft2: {
      name: "Salidas explosivas",
      drill: "Esprinta 10 metros desde parado, 8 veces, descansando del todo entre cada una.",
      test: "Esprinta 30 metros desde parado, cronometrado por un amigo, el mejor de 3 intentos.",
      tip: "Mueve fuerte los brazos. Las piernas siguen a los brazos.",
      targetText: "En menos de {n} segundos.",
    },
    ft3: {
      name: "Test de agilidad en T",
      drill: "Pon conos en forma de T: 10 metros hacia delante y 5 metros a cada lado. Esprinta, desplázate a la izquierda, a la derecha y vuelve.",
      test: "Termina el test en T en menos de 11 segundos.",
      tip: "Mantente bajo en los giros y apoya fuerte el pie de fuera.",
    },
    ft4: {
      name: "Sprints repetidos",
      drill: "Esprinta 40 metros, descansa 30 segundos y repite.",
      test: "10 sprints de 40 metros con 30 segundos de descanso entre ellos, cada uno por debajo de tu tiempo objetivo.",
      tip: "Vuelve caminando despacio durante el descanso para recuperarte antes.",
      targetText: "Cada sprint en menos de {n} segundos.",
    },
    ft5: {
      name: "Aguantar 90 minutos",
      drill: "Una vez por semana, combina una carrera de 5 km con series de sprint.",
      test: "Corre 5 km en menos de 25 minutos.",
      tip: "Dormir y beber agua importan tanto como entrenar.",
    },
    final: {
      name: "Listo para el partido",
      drill: "Juega partidos completos y usa todas las habilidades que has desbloqueado. Si puedes, graba un partido y míralo después.",
      test: "Juega un partido completo de 90 minutos y usa al menos 1 habilidad de cada rama.",
      tip: "Aquí es donde el trabajo da sus frutos. Disfrútalo.",
    },
  },
};

/** The Spanish football tree, with each skill's routine words (#80) from routines-football.ts. */
export const footballEs: TreeTranslation = {
  ...footballContent,
  skills: Object.fromEntries(
    Object.entries(footballContent.skills).map(([id, text]) => [id, { ...text, routine: footballRoutinesEs[id] }]),
  ),
};
