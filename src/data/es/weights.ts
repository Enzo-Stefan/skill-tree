import type { TreeTranslation } from "../../lib/translate";
import { weightsRoutinesEs } from "./routines-weights";

// Spanish for the strength tree. A FIRST DRAFT: someone fluent should check it before the app
// shows it to players (#19). Gym names that Spanish speakers usually say in English (goblet,
// kettlebell, dead bug, Pallof, Copenhague) stay close to the English. Numbers stay exactly as in English.

const weightsContent: TreeTranslation = {
  title: "Fuerza para el fútbol",
  shortName: "Fuerza",
  tagline: "Más fuerte, más rápido y más difícil de lesionar. Primero la técnica, luego el peso.",
  branches: {
    lg: "Piernas",
    pw: "Potencia",
    cr: "Core",
    ip: "Antilesiones",
  },
  levels: ["Novato", "Habitual del gimnasio", "Fuerte", "Explosivo", "Atleta", "De hierro"],
  skills: {
    root: {
      name: "Peso corporal básico",
      drill: "Aprende los movimientos sin peso: sentadillas, zancadas, flexiones y plancha. Grábate o pide a un entrenador que revise tu técnica. Si tienes menos de 16 años, entrena con un adulto que conozca los ejercicios.",
      test: "20 sentadillas sin peso, 10 flexiones y una plancha de 30 segundos, todo con buena técnica.",
      tip: "Una buena técnica ahora es lo que te permitirá añadir peso con seguridad después. Nunca cambies técnica por peso.",
    },
    lg1: {
      name: "Sentadilla goblet",
      drill: "Sujeta una mancuerna o una kettlebell contra el pecho. Baja hasta que los muslos queden paralelos al suelo y vuelve a subir.",
      test: "10 repeticiones con buena técnica, con el mayor peso que puedas manejar.",
      tip: "Empuja las rodillas hacia fuera, por encima de los pies, y mantén el pecho arriba.",
    },
    lg2: {
      name: "Sentadilla dividida",
      drill: "Un pie delante y otro detrás. Baja la rodilla de atrás hacia el suelo y vuelve a subir, con una mancuerna en cada mano.",
      test: "8 repeticiones con cada pierna con el mayor peso que puedas manejar.",
      tip: "Casi todo el peso va en el pie de delante. El fútbol se juega sobre una pierna cada vez.",
    },
    lg3: {
      name: "Peso muerto rumano",
      drill: "Sujeta una barra o mancuernas. Con las rodillas un poco flexionadas, lleva la cadera atrás y baja el peso pegado a las piernas hasta notar el estiramiento de los isquiotibiales. Luego ponte recto.",
      test: "8 repeticiones con el mayor peso que puedas manejar con la espalda recta.",
      tip: "Unos isquiotibiales fuertes protegen de la lesión más común en el fútbol.",
    },
    lg4: {
      name: "Sentadilla trasera",
      drill: "Barra sobre la parte alta de la espalda, en un rack con las barras de seguridad puestas. Baja hasta que los muslos queden paralelos al suelo y sube. Si tienes menos de 16 años, hazla solo con un adulto que conozca el ejercicio.",
      test: "5 repeticiones con el mayor peso que puedas manejar, con las barras de seguridad puestas.",
      tip: "Aprieta el abdomen como si alguien fuera a darte un golpecito en la tripa, y luego baja.",
    },
    lg5: {
      name: "Peso muerto hexagonal",
      drill: "Colócate dentro de una barra hexagonal, agarra las asas y ponte de pie empujando el suelo. Si tienes menos de 16 años, hazlo solo con un adulto que conozca el ejercicio.",
      test: "5 repeticiones con el mayor peso que puedas manejar con la espalda recta.",
      tip: "Piensa en un salto en el que no despegas del suelo. Empuja fuerte con los pies.",
    },
    pw1: {
      name: "Salto al cajón",
      drill: "Salta con los dos pies a un cajón firme y aterriza suave. Baja caminando, no saltando.",
      test: "5 saltos seguidos a un cajón a la altura de la rodilla, aterrizando sin ruido.",
      tip: "Aterriza en la misma posición desde la que saltas. Aterrizar sin ruido es señal de buen control.",
    },
    pw2: {
      name: "Swing con kettlebell",
      drill: "Flexiona la cadera y llévala adelante de golpe para balancear la kettlebell hasta la altura del pecho. Los brazos solo la guían.",
      test: "15 repeticiones con la kettlebell más pesada que puedas balancear con buena técnica.",
      tip: "La fuerza sale de la cadera, como en el último momento de un pase largo.",
    },
    pw3: {
      name: "Lanzar balón medicinal",
      drill: "Ponte de lado a una pared. Gira y lanza un balón medicinal contra la pared lo más fuerte que puedas, atrápalo y repite.",
      test: "10 lanzamientos por cada lado con el balón más pesado que puedas lanzar rápido.",
      tip: "Gira primero la cadera y después los hombros. Es el mismo orden que en un disparo.",
    },
    pw4: {
      name: "Salto a una pierna",
      drill: "Salta hacia delante desde una pierna, cae sobre la misma pierna y aguanta la caída 2 segundos.",
      test: "5 saltos con cada pierna, aguantando cada caída 2 segundos sin tambalearte.",
      tip: "Esprintar es saltar de una pierna a otra. Clava cada aterrizaje.",
    },
    pw5: {
      name: "Sentadilla con salto",
      drill: "Con mancuernas ligeras, baja a un cuarto de sentadilla y salta lo más alto que puedas. Aterriza suave y vuelve a colocarte.",
      test: "5 saltos con las mancuernas más pesadas que todavía te dejen saltar rápido.",
      tip: "Aquí importa más la velocidad que el peso. Si te vuelves lento, usa menos peso.",
    },
    cr1: {
      name: "Plancha",
      drill: "Antebrazos y puntas de los pies en el suelo, el cuerpo en línea recta. Aprieta los glúteos.",
      test: "Aguanta una plancha 60 segundos sin que baje la cadera.",
      tip: "Respira con normalidad. Aguantar la respiración no cuenta.",
    },
    cr2: {
      name: "Plancha lateral",
      drill: "Túmbate de lado, apoyado en un antebrazo, con la cadera levantada para que el cuerpo quede recto.",
      test: "Aguanta 45 segundos por cada lado.",
      tip: "Es el músculo que te mantiene en pie cuando alguien carga contra ti.",
    },
    cr3: {
      name: "Dead bug",
      drill: "Túmbate boca arriba, brazos arriba y rodillas dobladas por encima de la cadera. Baja despacio el brazo y la pierna contrarios mientras la zona lumbar sigue pegada al suelo.",
      test: "12 repeticiones lentas por cada lado con la zona lumbar en el suelo todo el tiempo.",
      tip: "Lo importante es ir despacio. Si la espalda se despega, haz el movimiento más pequeño.",
    },
    cr4: {
      name: "Press Pallof",
      drill: "Ponte de lado a una polea o una goma elástica. Sujeta el asa a la altura del pecho, estírala al frente y vuelve sin dejar que te gire.",
      test: "10 repeticiones por cada lado con el mayor peso que puedas mantener quieto.",
      tip: "Resistir el giro es lo que te mantiene en equilibrio cuando proteges el balón.",
    },
    cr5: {
      name: "Elevación de rodillas",
      drill: "Cuélgate de una barra y sube las rodillas hasta el pecho sin balancearte.",
      test: "12 repeticiones sin balancearte.",
      tip: "Arriba, enrolla la cadera. Si solo subes las piernas trabajas los flexores de cadera, no el core.",
    },
    ip1: {
      name: "Gemelo a una pierna",
      drill: "Ponte con un pie en un escalón y el talón por fuera. Sube de puntillas y baja despacio.",
      test: "15 repeticiones con cada pierna, subiendo del todo, sin agarrarte fuerte.",
      tip: "Unos gemelos fuertes protegen los tobillos y el tendón de Aquiles. Sube del todo y baja del todo.",
    },
    ip2: {
      name: "Puente a una pierna",
      drill: "Túmbate boca arriba con un pie en el suelo y la otra pierna estirada. Sube la cadera y baja despacio.",
      test: "12 repeticiones con cada pierna, aguantando 2 segundos arriba.",
      tip: "Aprieta el glúteo arriba. Quita presión a los isquiotibiales y a las rodillas.",
    },
    ip3: {
      name: "Plancha Copenhague",
      drill: "Plancha lateral con la rodilla de arriba apoyada en un banco y la pierna de abajo sin tocar el suelo. Cuando te resulte fácil, apoya el pie en el banco en lugar de la rodilla, que es mucho más difícil.",
      test: "Aguanta 20 segundos por cada lado con la rodilla en el banco.",
      tip: "Trabaja los aductores, que se lesionan en los pases largos y al estirarte a por el balón.",
    },
    ip4: {
      name: "Curl nórdico",
      drill: "De rodillas, con un compañero sujetándote los tobillos. Deja caer el cuerpo hacia delante lo más despacio que puedas, frena con las manos y empuja para volver.",
      test: "5 repeticiones, tardando al menos 3 segundos en bajar cada vez.",
      tip: "Este ejercicio reduce mucho las lesiones de isquiotibiales. Baja despacio aunque caigas al final.",
    },
    ip5: {
      name: "Peso muerto a 1 pierna",
      drill: "De pie sobre una pierna, con una mancuerna en la mano contraria. Inclínate hacia delante hasta que el cuerpo quede paralelo al suelo y vuelve a ponerte recto.",
      test: "8 repeticiones con cada pierna con la mancuerna más pesada que puedas manejar sin perder el equilibrio.",
      tip: "Mantén la cadera paralela al suelo. Entrena el equilibrio y los isquiotibiales a la vez.",
    },
    final: {
      name: "Fuerte para el partido",
      drill: "Júntalo todo: una sesión de sentadilla goblet, swings con kettlebell, curl nórdico y plancha, dos veces por semana durante 4 semanas.",
      test: "Completa 8 sesiones en 4 semanas, cada una con al menos 3 ejercicios distintos de este árbol.",
      tip: "La fuerza se pierde en pocas semanas si no entrenas. Mantén 2 sesiones cortas por semana durante la temporada.",
    },
  },
};

/** The Spanish strength tree, with each skill's routine words (#80) from routines-weights.ts. */
export const weightsEs: TreeTranslation = {
  ...weightsContent,
  skills: Object.fromEntries(
    Object.entries(weightsContent.skills).map(([id, text]) => [id, { ...text, routine: weightsRoutinesEs[id] }]),
  ),
};
