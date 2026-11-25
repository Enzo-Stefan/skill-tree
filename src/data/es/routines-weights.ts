import type { RoutineText } from "../../lib/translate";

// Spanish for the strength routines (#18, #80): only the words. Every number (sets, reps, seconds,
// rest, sessions, minutes) stays in src/data/routines-weights.ts, and the tests check that the numbers
// and units written in these sentences match the English ones. Exercises are in the same order as the English.
//
// A FIRST DRAFT, like the rest of the Spanish: someone fluent should check it, especially the gym terms
// (goblet, kettlebell, dead bug, Pallof, Copenhague stay close to the English), before Spanish is picked up
// from the phone's setting (#19).

const WARM_GYM =
  "8 minutos: trote suave o saltar la cuerda, balanceos de piernas, círculos de cadera, sentadillas y zancadas sin peso. Luego haz 1 o 2 series ligeras del primer ejercicio antes de las pesadas.";
const COOL_GYM = "5 minutos: camina y luego estira cuádriceps, isquiotibiales, cadera y gemelos, 20 segundos de cada lado.";
const WARM_JUMP =
  "8 minutos: trote suave, rodillas arriba, saltar la cuerda y sentadillas sin peso. Luego haz 3 saltos pequeños de prueba, un poco más altos cada vez.";
const WARM_CORE = "5 minutos: trote suave o saltar la cuerda, círculos de brazos y de cadera, y unas cuantas posturas lentas de gato-vaca.";
const COOL_CORE = "3 minutos: tumbado boca arriba, abrázate las rodillas y luego estira la cadera y la zona lumbar con suavidad.";

export const weightsRoutinesEs: Record<string, RoutineText> = {
  root: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Sentadillas sin peso", howTo: "Pies a la anchura de los hombros, siéntate hacia atrás y hacia abajo hasta que los muslos queden paralelos al suelo y levántate. Pecho arriba." },
      { name: "Flexiones", howTo: "Cuerpo recto de la cabeza a los talones. Apoya las rodillas si no puedes mantenerlo recto." },
      { name: "Plancha", howTo: "Antebrazos y puntas de los pies en el suelo, cuerpo recto, aprieta los glúteos." },
    ],
    coolDown: COOL_CORE,
  },
  lg1: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Sentadilla goblet", howTo: "Sujeta un peso contra el pecho. Baja hasta que los muslos queden paralelos al suelo y levántate. Añade peso solo cuando todas las repeticiones salgan bien." },
      { name: "Zancadas sin peso", howTo: "Da un paso adelante, baja la rodilla de atrás hacia el suelo y empuja para subir. Alterna las piernas." },
    ],
    coolDown: COOL_GYM,
  },
  lg2: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Sentadilla dividida", howTo: "Un pie delante y otro detrás, con una mancuerna en cada mano. Baja la rodilla de atrás hacia el suelo y empuja para subir. Termina todas las repeticiones con una pierna y luego cambia." },
      { name: "Sentadilla goblet", howTo: "Una serie más ligera para mantener fresco el movimiento. Muslos paralelos al suelo." },
    ],
    coolDown: COOL_GYM,
  },
  lg3: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Peso muerto rumano", howTo: "Sujeta un peso delante de los muslos. Lleva la cadera hacia atrás con la espalda recta hasta notar el estiramiento de los isquiotibiales y luego empuja la cadera hacia delante." },
      { name: "Ejercicio de bisagra de cadera", howTo: "Sin peso. Manos en la cadera, inclínate hacia atrás con la cadera hasta dejar la espalda casi recta y vuelve a estar erguido. Lento y controlado." },
    ],
    coolDown: COOL_GYM,
  },
  lg4: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Sentadilla trasera", howTo: "Barra sobre la parte alta de la espalda, en un rack con las barras de seguridad puestas. Baja hasta que los muslos queden paralelos y levántate. Sube el peso con 2 series de calentamiento y nunca hagas sentadillas solo sin las barras de seguridad." },
      { name: "Sentadilla dividida", howTo: "Una serie más ligera con cada pierna para igualar cualquier diferencia entre ellas." },
    ],
    coolDown: COOL_GYM,
  },
  lg5: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Peso muerto con barra hexagonal", howTo: "Colócate dentro de la barra, agarra las asas, mantén la espalda recta y levántate empujando el suelo. Bájala con control." },
      { name: "Sentadilla goblet", howTo: "Una serie más ligera después del ejercicio pesado. Muslos paralelos al suelo." },
    ],
    coolDown: COOL_GYM,
  },
  pw1: {
    warmUp: WARM_JUMP,
    exercises: [
      { name: "Salto al cajón", howTo: "Salta sobre un cajón firme con los dos pies y aterriza con suavidad, con las rodillas flexionadas. Baja andando, no saltando. Descansa del todo entre saltos para que cada uno sea rápido." },
      { name: "Salto de sentadilla", howTo: "Baja en sentadilla y salta lo más alto que puedas. Aterriza con suavidad y vuelve a empezar." },
    ],
    coolDown: COOL_GYM,
  },
  pw2: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Swing con kettlebell", howTo: "Inclínate con la cadera y lánzala hacia delante para llevar la kettlebell hasta la altura del pecho. Los brazos solo la guían." },
      { name: "Ejercicio de bisagra de cadera", howTo: "Sin peso. Inclínate hacia atrás con la espalda recta y vuelve a estar erguido, para fijar el movimiento." },
    ],
    coolDown: COOL_GYM,
  },
  pw3: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Lanzamiento lateral de balón medicinal", howTo: "Colócate de lado a una pared. Gira y lanza el balón contra la pared lo más fuerte que puedas, atrápalo y repite. Termina todas las repeticiones de un lado y luego cambia." },
      { name: "Pase de pecho con balón medicinal", howTo: "De frente a la pared, pasa el balón con fuerza desde el pecho. Atrápalo y repite." },
    ],
    coolDown: COOL_CORE,
  },
  pw4: {
    warmUp: WARM_JUMP,
    exercises: [
      { name: "Zancada saltada a una pierna", howTo: "Salta hacia delante desde una pierna, aterriza en la misma pierna y aguanta el aterrizaje 2 segundos. Termina una pierna y luego cambia." },
      { name: "Saltitos a una pierna en el sitio", howTo: "Salta sobre una pierna y aterriza con suavidad cada vez, con la rodilla sobre la punta del pie." },
    ],
    coolDown: COOL_GYM,
  },
  pw5: {
    warmUp: WARM_JUMP,
    exercises: [
      { name: "Salto de sentadilla con peso", howTo: "Con mancuernas ligeras, baja un poco en una sentadilla corta y salta lo más alto que puedas. Aterriza con suavidad y vuelve a empezar. Si los saltos se vuelven lentos, el peso es demasiado." },
      { name: "Salto al cajón", howTo: "Una serie más ligera sobre un cajón más bajo, aterrizando en silencio." },
    ],
    coolDown: COOL_GYM,
  },
  cr1: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Plancha", howTo: "Antebrazos y puntas de los pies en el suelo, cuerpo en línea recta. Aprieta los glúteos y no dejes caer la cadera." },
      { name: "Dead bug (bicho muerto)", howTo: "Tumbado boca arriba, brazos arriba y rodillas sobre la cadera. Baja despacio el brazo y la pierna contrarios sin separar la zona lumbar del suelo." },
    ],
    coolDown: COOL_CORE,
  },
  cr2: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Plancha lateral", howTo: "Tumbado de lado, apoyado sobre un antebrazo, con la cadera elevada para que el cuerpo quede recto. Termina un lado y luego cambia." },
      { name: "Plancha", howTo: "Mantén la cadera nivelada y respira con calma." },
    ],
    coolDown: COOL_CORE,
  },
  cr3: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Dead bug (bicho muerto)", howTo: "Baja despacio el brazo y la pierna contrarios mientras la zona lumbar se mantiene en el suelo todo el tiempo. Si se levanta, haz el movimiento más corto." },
      { name: "Bird dog (perro y pájaro)", howTo: "En posición de gateo, estira un brazo y la pierna contraria a la altura de la espalda. Aguanta 2 segundos y cambia." },
    ],
    coolDown: COOL_CORE,
  },
  cr4: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Press Pallof", howTo: "Colócate de lado a una polea o una banda. Sujeta el asa a la altura del pecho, empújala hacia delante y vuelve sin dejar que te gire. Termina un lado y luego cambia." },
      { name: "Plancha lateral", howTo: "Un aguante corto de cada lado para terminar." },
    ],
    coolDown: COOL_CORE,
  },
  cr5: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Elevación de rodillas colgado", howTo: "Cuélgate de una barra y sube las rodillas hacia el pecho sin balancearte. Baja despacio." },
      { name: "Plancha", howTo: "Un último aguante para terminar, con la cadera nivelada." },
    ],
    coolDown: COOL_CORE,
  },
  ip1: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Elevación de gemelos a una pierna", howTo: "De pie sobre un pie en un escalón, con el talón fuera. Sube sobre las puntas y baja despacio. Termina una pierna y luego cambia." },
      { name: "Equilibrio a una pierna", howTo: "De pie sobre una pierna con la rodilla ligeramente flexionada y la cadera nivelada." },
    ],
    coolDown: COOL_GYM,
  },
  ip2: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Puente de glúteos a una pierna", howTo: "Tumbado boca arriba, con un pie en el suelo y la otra pierna recta. Sube la cadera, aguanta 2 segundos y baja despacio." },
      { name: "Puente de glúteos", howTo: "Con los dos pies en el suelo, sube la cadera y aprieta arriba." },
    ],
    coolDown: COOL_GYM,
  },
  ip3: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Plancha Copenhague", howTo: "Plancha lateral con la rodilla de arriba apoyada en un banco y la pierna de abajo en el aire. Para si te duele la ingle. Termina un lado y luego cambia." },
      { name: "Elevación lateral de pierna", howTo: "Tumbado de lado, sube la pierna de arriba despacio y bájala." },
    ],
    coolDown: COOL_GYM,
  },
  ip4: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Curl nórdico de isquiotibiales", howTo: "De rodillas, con un compañero sujetándote los tobillos. Baja el cuerpo hacia delante lo más despacio que puedas, ampárate con las manos y empuja para volver a subir." },
      { name: "Puente de isquiotibiales", howTo: "Tumbado boca arriba con los talones sobre un banco o escalón, sube la cadera y baja despacio." },
    ],
    coolDown: COOL_GYM,
  },
  ip5: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Peso muerto rumano a una pierna", howTo: "De pie sobre una pierna con una mancuerna en la mano contraria. Inclínate hacia delante hasta dejar el cuerpo paralelo al suelo y vuelve a estar erguido. Termina una pierna y luego cambia." },
      { name: "Equilibrio a una pierna", howTo: "De pie sobre una pierna con la rodilla ligeramente flexionada y la cadera nivelada." },
    ],
    coolDown: COOL_GYM,
  },
  final: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Sentadilla goblet", howTo: "Empieza por las piernas. Muslos paralelos al suelo." },
      { name: "Swing con kettlebell", howTo: "Inclínate con la cadera y lánzala hacia delante; los brazos solo guían." },
      { name: "Curl nórdico de isquiotibiales", howTo: "Baja lo más despacio que puedas, con un compañero sujetándote los tobillos." },
      { name: "Plancha", howTo: "Termina con un aguante con el cuerpo recto." },
    ],
    coolDown: COOL_GYM,
  },
};
