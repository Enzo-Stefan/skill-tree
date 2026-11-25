import type { RoutineText } from "../../lib/translate";

// Spanish for the football routines (#80): only the words. Every number (sets, reps, seconds, rest,
// sessions, minutes) stays in src/data/routines-football.ts, and the tests check that the numbers
// written in these sentences match the English ones. Exercises are in the same order as the English.
//
// A FIRST DRAFT, like the rest of the Spanish: someone fluent should check it, especially the football
// and gym terms, before Spanish is picked up from the phone's setting (#19).
//
// The wording leans towards Spain ("móvil", "portería", "ve a por él", "gemelos", "diana"). If players in
// Latin America are in scope, those are the words to adapt ("celular", "arco", "ve por él", "pantorrillas").

const WARM_BALL = "5 minutos: trote suave, balanceos de piernas y círculos de cadera, y luego 20 toques suaves al balón con los dos pies.";
const COOL_BALL = "5 minutos: camina y luego estira gemelos, isquiotibiales y cadera, 20 segundos de cada lado.";
const WARM_RUN = "8 minutos: trote suave, rodillas arriba, talones al glúteo, desplazamientos laterales y luego dos carreras progresivas al 70 % de velocidad.";
const COOL_RUN = "De 5 a 8 minutos: camina despacio hasta que se calme la respiración y luego estira isquiotibiales, cuádriceps y gemelos.";

const ball = (exercises: RoutineText["exercises"]): RoutineText => ({ warmUp: WARM_BALL, coolDown: COOL_BALL, exercises });
const run = (exercises: RoutineText["exercises"]): RoutineText => ({ warmUp: WARM_RUN, coolDown: COOL_RUN, exercises });

export const footballRoutinesEs: Record<string, RoutineText> = {
  root: ball([
    { name: "Pase a la pared y control", howTo: "Pasa contra una pared desde 5 m y para el rebote en seco con el interior del pie. Alterna los pies." },
    { name: "Paradas con la suela", howTo: "Rueda el balón unos metros hacia delante, ve a por él y páralo bajo la suela. Alterna los pies." },
  ]),
  bc1: ball([
    { name: "Toques con bote", howTo: "Golpea el balón hacia arriba con el empeine, déjalo botar una vez y golpéalo otra vez. Primero el pie bueno y luego el débil." },
    { name: "Toques seguidos", howTo: "Haz toques sin botes y cuenta tu mejor racha en cada serie." },
  ]),
  bc2: ball([
    { name: "Control con el muslo tras lanzarte el balón", howTo: "Lanza el balón por encima de tu cabeza y amortígualo con el muslo hasta el suelo. Cambia de pierna en cada serie." },
    { name: "Control de rebotes en la pared", howTo: "Golpea el balón alto contra una pared y controla el rebote con el pecho o el pie antes de que bote dos veces." },
  ]),
  bc3: ball([
    { name: "Toques alternando pies", howTo: "Haz toques cambiando de pie en cada uno." },
    { name: "Toques con el muslo", howTo: "Haz toques con los pies y añade un toque de muslo cada cinco toques. Sin cabezazos aquí: el remate de cabeza se practica, con límite, en su propia habilidad." },
  ]),
  bc4: ball([
    { name: "Toque lejos del cono", howTo: "Pon un cono detrás de ti como si fuera un defensa. Pasa contra una pared, controla el rebote lejos del cono y conduce 3 m." },
    { name: "Mira y gira", howTo: "Mira por encima del hombro antes de cada rebote y gira a izquierda o derecha con el primer toque." },
  ]),
  bc5: ball([
    { name: "Rodar el balón protegiéndolo", howTo: "Rueda el balón de lado a lado bajo la suela, con las rodillas flexionadas y un brazo extendido, como si tuvieras un defensa detrás." },
    { name: "Parar y aguantar", howTo: "Conduce hasta un cono, para el balón de espaldas al cono y aguántalo bajo la suela durante 5 segundos." },
  ]),
  ps1: ball([
    { name: "Pases a la diana", howTo: "Pasa a una zona del ancho de un balón en una pared desde 10 m. Para cada rebote antes del siguiente pase." },
    { name: "Devoluciones de primeras", howTo: "Desde 6 m, devuelve el rebote de primeras con el interior del pie." },
  ]),
  ps2: ball([
    { name: "Pases a la diana con el pie débil", howTo: "El ejercicio de la diana en la pared desde 10 m, solo con el pie débil. Ve despacio y apunta bien." },
    { name: "Pie débil, de primeras", howTo: "Desde 5 m, devuelve cada rebote de primeras con el pie débil." },
  ]),
  ps3: ball([
    { name: "Pases a la pared contra reloj", howTo: "Desde 5 m, pases a un toque contra una pared, alternando los pies, durante toda la serie." },
    { name: "Ritmo a dos toques", howTo: "Controla y pasa en dos toques lo más rápido que puedas, manteniendo el balón raso." },
  ]),
  ps4: ball([
    { name: "Pases tensos a un objetivo", howTo: "Desde 20 a 30 m, golpea por el centro del balón con el empeine hacia un cono o una portería." },
    { name: "Que vaya raso", howTo: "El mismo golpeo desde 15 m. El balón no debe subir por encima de la altura de la rodilla." },
  ]),
  ps5: ball([
    { name: "Pases altos a un cuadrado", howTo: "Marca un cuadrado de 5 m a 30 o 40 m de distancia y lanza balones altos dentro. Recógelos por tandas." },
    { name: "Carrerilla y apoyo", howTo: "Practica la carrerilla curva y el apoyo del pie de apoyo, primero sin balón y luego desde 20 m." },
  ]),
  dr1: ball([
    { name: "Eslalon", howTo: "6 conos a 1 m de distancia. Conduce entre ellos y vuelve usando los dos pies, tocando el balón en cada paso." },
    { name: "Solo interior, solo exterior", howTo: "El mismo eslalon usando solo el interior de los pies y luego solo el exterior." },
  ]),
  dr2: ball([
    { name: "Cortes en zigzag", howTo: "Conduce en zigzag entre conos, cortando con el interior y luego con el exterior del mismo pie." },
    { name: "Eslalon con un solo pie", howTo: "Conduce el eslalon solo con el pie derecho y luego solo con el izquierdo." },
  ]),
  dr3: ball([
    { name: "Bicicletas en el sitio", howTo: "Pasa el pie por encima del balón sin moverte del sitio, alternando los pies, para coger el ritmo." },
    { name: "Bicicleta ante un cono", howTo: "Corre hacia un cono, haz la bicicleta, empuja el balón hacia el otro lado y acelera durante 5 m." },
  ]),
  dr4: ball([
    { name: "Giros de Cruyff", howTo: "Conduce hacia un cono, amaga un pase, arrastra el balón por detrás de tu pierna de apoyo y sal. Con los dos pies." },
    { name: "Arrastres", howTo: "Arrastra el balón hacia atrás con la suela y gira, alternando los pies." },
  ]),
  dr5: ball([
    { name: "Supera el cono", howTo: "Conduce a velocidad hacia un cono, usa un regate para pasarlo por cualquier lado y luego conduce por una puerta de 2 m." },
    { name: "Cambio de ritmo", howTo: "Conduce despacio durante 5 m, luego acelera con fuerza más allá de un cono y sigue durante 10 m." },
  ]),
  sh1: ball([
    { name: "Remates a las esquinas", howTo: "Desde el punto de penalti, tiros con el interior a las esquinas inferiores marcadas." },
    { name: "Anúncialo y ejecútalo", howTo: "Di en voz alta la esquina antes de cada tiro y dispara a esa esquina." },
  ]),
  sh2: ball([
    { name: "Disparos con el empeine", howTo: "Desde 18 m, golpea el balón con el empeine, apuntando bajo." },
    { name: "Golpeos de técnica", howTo: "Carrerilla corta desde 10 m: cabeza sobre el balón, punta hacia abajo y cae sobre el pie de golpeo." },
  ]),
  sh3: ball([
    { name: "Esquinas con el pie débil", howTo: "Tiros con el interior a las esquinas inferiores desde 12 m, solo con el pie débil." },
    { name: "Controla y dispara con el pie débil", howTo: "Empuja el balón hacia delante con el pie débil y dispara con él." },
  ]),
  sh4: ball([
    { name: "Remates al rebote en la pared", howTo: "Pasa con fuerza contra una pared en ángulo y dispara el rebote de primeras a una portería o a un objetivo." },
    { name: "Tiros con balón rodando", howTo: "Rueda el balón por delante de ti y dispara sin pararlo." },
  ]),
  sh5: ball([
    { name: "Voleas con balón soltado", howTo: "Suelta el balón desde las manos y golpéalo de volea a un objetivo antes de que bote." },
    { name: "Voleas contra la pared", howTo: "Lanza el balón contra una pared y golpea el rebote de volea." },
  ]),
  df1: ball([
    { name: "Zigzag de contención", howTo: "De perfil, con las rodillas flexionadas, desplázate hacia atrás en zigzag entre conos sin cruzar los pies." },
    { name: "Mantener la posición", howTo: "Mantén la posición defensiva sobre las puntas, desplazándote 2 m a la izquierda o a la derecha cada pocos segundos." },
  ]),
  df2: ball([
    { name: "Desplazamientos en espejo", howTo: "Desplázate entre dos conos separados 5 m, de perfil, lo más rápido que puedas con buena técnica." },
    { name: "Retroceso y giro", howTo: "Retrocede 5 m, gira la cadera y esprinta 5 m. Gira hacia los dos lados." },
  ]),
  df4: ball([
    { name: "Cabezazos tras lanzarte el balón", howTo: "Lanza el balón hacia arriba y despéjalo hacia arriba y lejos con la frente, con los ojos abiertos. Usa un balón más ligero mientras aprendes y para en 10 cabezazos." },
    { name: "Fuerza de cuello", howTo: "Pon las manos en la frente y empuja con suavidad mientras mantienes el cuello quieto. Después, en la parte de atrás de la cabeza." },
  ]),
  df3: ball([
    { name: "Entrada de bloqueo sobre balón parado", howTo: "Apoya el pie junto al balón y empuja a través de él con el interior del pie, con el peso del cuerpo detrás." },
    { name: "Aproximación y colocación", howTo: "Trota hacia un balón a 5 m, reduce la velocidad, colócate de perfil y bloquéalo." },
  ]),
  df5: ball([
    { name: "Pasos de reacción", howTo: "Colócate entre dos conos. Cuando suene un pitido al azar en el temporizador del móvil, da un paso y estírate hacia un lado." },
    { name: "Intercepciones en la pared", howTo: "Golpea el balón en ángulo contra una pared y cruza un paso para cortar el rebote." },
  ]),
  ft1: run([
    { name: "Carrera suave", howTo: "Corre a un ritmo en el que todavía puedas hablar." },
    { name: "Intervalos de correr y caminar", howTo: "Corre 3 minutos y camina 1 minuto." },
  ]),
  ft2: run([
    { name: "Salidas de 10 m", howTo: "Esprinta 10 m desde parado y vuelve caminando." },
    { name: "Esprints de 30 m", howTo: "Esprinta 30 m a máxima velocidad y vuelve caminando despacio." },
  ]),
  ft3: run([
    { name: "Carreras del test en T", howTo: "Conos en forma de T: 10 m hacia delante y 5 m a cada lado. Esprinta, desplázate a la izquierda, a la derecha y vuelve." },
    { name: "Desplazamientos laterales", howTo: "Desplázate 5 m a la izquierda y a la derecha entre dos conos lo más rápido que puedas." },
  ]),
  ft4: run([{ name: "Repeticiones de 40 m", howTo: "Esprinta 40 m, descansa 30 segundos y repite." }]),
  ft5: run([
    { name: "Carrera a ritmo constante", howTo: "Corre a un ritmo constante, cómodamente exigente." },
    { name: "Arrancadas a máxima velocidad", howTo: "Durante la carrera, esprinta 20 segundos cada 3 minutos." },
  ]),
  final: run([
    { name: "Circuito de habilidades", howTo: "Una ronda: 20 toques, 10 pases a la pared, un eslalon entre conos y 5 tiros. Descansa y vuelve a empezar." },
    { name: "Partido reducido", howTo: "Juega un partido reducido con amigos e intenta usar una habilidad de cada rama." },
  ]),
};
