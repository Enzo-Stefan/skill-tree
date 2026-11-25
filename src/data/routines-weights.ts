import type { PerLevel, Routine } from "../types";

// Training routines for the strength tree (#18, #80), one per skill, keyed by skill id. weights.ts
// attaches them to its skills. The tree has no player levels, so every number is the same for
// everyone ("all"). A player trains each lift with the heaviest weight they can manage with good
// form, like the tests say; the app doesn't prescribe a weight.
//
// A FIRST DRAFT: sets, reps and rest are sensible starting numbers for young players, and a coach
// should look at them before they are treated as final. Under 16, lifts are done with an adult
// who knows them (the drills already say so).

/** The same number at every level. */
const all = (n: number): PerLevel => ({ all: n });

const WARM_GYM =
  "8 minutes: easy jog or skipping, leg swings, hip circles, bodyweight squats and lunges. Then do 1 or 2 light sets of the first lift before the heavy ones.";
const COOL_GYM = "5 minutes: walk, then stretch quads, hamstrings, hips and calves, 20 seconds each side.";
const WARM_JUMP =
  "8 minutes: easy jog, high knees, skipping and bodyweight squats. Then 3 small practice jumps, getting a little higher each time.";
const WARM_CORE = "5 minutes: easy jog or skipping, arm circles and hip circles, then a few slow cat-cows.";
const COOL_CORE = "3 minutes: lie on your back, hug your knees, then stretch hips and lower back gently.";

export const weightsRoutines: Record<string, Routine> = {
  root: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Bodyweight squats", howTo: "Feet shoulder-width apart, sit back and down until your thighs are level, then stand up. Chest up.", sets: all(3), reps: all(15), restSeconds: 45 },
      { name: "Push-ups", howTo: "Body in a straight line from head to heels. Go to your knees if you can't keep it straight.", sets: all(3), reps: all(8), restSeconds: 45 },
      { name: "Plank", howTo: "Forearms and toes on the floor, body straight, squeeze your glutes.", sets: all(3), seconds: all(30), restSeconds: 30 },
    ],
    coolDown: COOL_CORE,
    sessionsPerWeek: 2,
    minutes: all(25),
  },
  lg1: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Goblet squat", howTo: "Hold a weight against your chest. Squat until your thighs are level with the floor, then stand up. Add weight only when every rep looks good.", sets: all(3), reps: all(10), restSeconds: 90 },
      { name: "Bodyweight lunges", howTo: "Step forward, lower your back knee towards the floor and push back up. Alternate legs.", sets: all(2), reps: all(10), restSeconds: 60 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 2,
    minutes: all(35),
  },
  lg2: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Split squat", howTo: "One foot forward, one back, a dumbbell in each hand. Lower your back knee towards the floor and push up. Finish all reps on one leg, then switch.", sets: all(3), reps: all(8), restSeconds: 90 },
      { name: "Goblet squat", howTo: "A lighter set to keep the pattern fresh. Thighs level with the floor.", sets: all(2), reps: all(10), restSeconds: 60 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 2,
    minutes: all(40),
  },
  lg3: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Romanian deadlift", howTo: "Hold a weight in front of your thighs. Push your hips back with a flat back until you feel your hamstrings stretch, then drive your hips forward.", sets: all(3), reps: all(8), restSeconds: 90 },
      { name: "Hip hinge drill", howTo: "No weight. Hands on your hips, hinge back until your back is nearly flat, then stand tall. Slow and controlled.", sets: all(2), reps: all(12), restSeconds: 45 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 2,
    minutes: all(35),
    heavy: true,
  },
  lg4: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Back squat", howTo: "Bar on your upper back in a rack with safety bars set. Squat until your thighs are level, then stand up. Build the weight over 2 warm-up sets and never squat alone without safety bars.", sets: all(4), reps: all(5), restSeconds: 150 },
      { name: "Split squat", howTo: "A lighter set on each leg to even out any difference between your legs.", sets: all(2), reps: all(8), restSeconds: 60 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 2,
    minutes: all(45),
    heavy: true,
  },
  lg5: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Trap bar deadlift", howTo: "Stand inside the bar, grip the handles, keep your back flat and stand up by pushing the floor away. Lower it with control.", sets: all(4), reps: all(5), restSeconds: 150 },
      { name: "Goblet squat", howTo: "A lighter set after the heavy lift. Thighs level with the floor.", sets: all(2), reps: all(10), restSeconds: 60 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 2,
    minutes: all(45),
    heavy: true,
  },
  pw1: {
    warmUp: WARM_JUMP,
    exercises: [
      { name: "Box jump", howTo: "Jump onto a sturdy box from two feet and land softly with bent knees. Step down, don't jump down. Rest fully between jumps so each one is fast.", sets: all(4), reps: all(5), restSeconds: 60 },
      { name: "Squat jump", howTo: "Dip into a squat and jump as high as you can. Land softly and reset.", sets: all(2), reps: all(6), restSeconds: 45 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 2,
    minutes: all(30),

    heavy: true,
  },
  pw2: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Kettlebell swing", howTo: "Hinge at the hips and snap them forward to swing the kettlebell to chest height. Your arms just guide it.", sets: all(4), reps: all(15), restSeconds: 60 },
      { name: "Hip hinge drill", howTo: "No weight. Hinge back with a flat back and stand tall, to groove the movement.", sets: all(2), reps: all(10), restSeconds: 30 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 2,
    minutes: all(30),
  },
  pw3: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Med ball side throw", howTo: "Stand side-on to a wall. Rotate and throw the ball into the wall as hard as you can, catch it and go again. Finish all reps on one side, then switch.", sets: all(3), reps: all(10), restSeconds: 60 },
      { name: "Med ball chest pass", howTo: "Face the wall and pass the ball hard from your chest. Catch it and go again.", sets: all(2), reps: all(10), restSeconds: 45 },
    ],
    coolDown: COOL_CORE,
    sessionsPerWeek: 2,
    minutes: all(25),
  },
  pw4: {
    warmUp: WARM_JUMP,
    exercises: [
      { name: "Single-leg bound", howTo: "Bound forward from one leg, land on the same leg and hold the landing for 2 seconds. Finish one leg, then switch.", sets: all(3), reps: all(5), restSeconds: 60 },
      { name: "Single-leg hop in place", howTo: "Hop on one leg and land softly each time, with your knee over your toes.", sets: all(2), reps: all(8), restSeconds: 45 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 2,
    minutes: all(30),

    heavy: true,
  },
  pw5: {
    warmUp: WARM_JUMP,
    exercises: [
      { name: "Jump squat", howTo: "Hold light dumbbells, dip into a quarter squat and jump as high as you can. Land softly and reset. If the jumps slow down, the weight is too heavy.", sets: all(4), reps: all(5), restSeconds: 90 },
      { name: "Box jump", howTo: "A lighter set onto a lower box, landing quietly.", sets: all(2), reps: all(5), restSeconds: 60 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 2,
    minutes: all(35),

    heavy: true,
  },
  cr1: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Plank", howTo: "Forearms and toes on the floor, body in a straight line. Squeeze your glutes and keep your hips from dropping.", sets: all(3), seconds: all(45), restSeconds: 45 },
      { name: "Dead bug", howTo: "Lie on your back, arms up, knees over your hips. Lower the opposite arm and leg slowly, keeping your lower back flat.", sets: all(2), reps: all(8), restSeconds: 30 },
    ],
    coolDown: COOL_CORE,
    sessionsPerWeek: 3,
    minutes: all(20),
  },
  cr2: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Side plank", howTo: "Lie on your side, up on one forearm, hips lifted so your body is straight. Finish one side, then switch.", sets: all(3), seconds: all(30), restSeconds: 30 },
      { name: "Plank", howTo: "Keep your hips level and breathe steadily.", sets: all(2), seconds: all(45), restSeconds: 30 },
    ],
    coolDown: COOL_CORE,
    sessionsPerWeek: 3,
    minutes: all(20),
  },
  cr3: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Dead bug", howTo: "Lower the opposite arm and leg slowly while your lower back stays on the floor the whole time. If it lifts, make the range smaller.", sets: all(3), reps: all(10), restSeconds: 30 },
      { name: "Bird dog", howTo: "On hands and knees, reach one arm and the opposite leg out level with your back. Hold for 2 seconds, then switch.", sets: all(2), reps: all(8), restSeconds: 30 },
    ],
    coolDown: COOL_CORE,
    sessionsPerWeek: 3,
    minutes: all(20),
  },
  cr4: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Pallof press", howTo: "Stand side-on to a cable or band. Hold the handle at your chest, press it straight out and back without letting it twist you. Finish one side, then switch.", sets: all(3), reps: all(10), restSeconds: 45 },
      { name: "Side plank", howTo: "A short hold on each side to finish.", sets: all(2), seconds: all(20), restSeconds: 30 },
    ],
    coolDown: COOL_CORE,
    sessionsPerWeek: 2,
    minutes: all(20),
  },
  cr5: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Hanging knee raise", howTo: "Hang from a bar and lift your knees to your chest without swinging. Lower slowly.", sets: all(3), reps: all(10), restSeconds: 60 },
      { name: "Plank", howTo: "A final hold to finish, hips level.", sets: all(2), seconds: all(45), restSeconds: 30 },
    ],
    coolDown: COOL_CORE,
    sessionsPerWeek: 2,
    minutes: all(25),
  },
  ip1: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Single-leg calf raise", howTo: "Stand on one foot on a step, heel hanging off. Rise onto your toes and lower slowly. Finish one leg, then switch.", sets: all(3), reps: all(15), restSeconds: 45 },
      { name: "Single-leg balance", howTo: "Stand on one leg with a slight bend in the knee and keep your hips level.", sets: all(2), seconds: all(30), restSeconds: 30 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 3,
    minutes: all(20),
  },
  ip2: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Single-leg glute bridge", howTo: "Lie on your back, one foot on the floor and the other leg straight. Push your hips up, hold for 2 seconds and lower slowly.", sets: all(3), reps: all(12), restSeconds: 45 },
      { name: "Glute bridge", howTo: "Both feet on the floor, push your hips up and squeeze at the top.", sets: all(2), reps: all(15), restSeconds: 30 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 3,
    minutes: all(20),
  },
  ip3: {
    warmUp: WARM_CORE,
    exercises: [
      { name: "Copenhagen plank", howTo: "Side plank with your top knee resting on a bench and your bottom leg off the floor. Stop if your groin hurts. Finish one side, then switch.", sets: all(3), seconds: all(15), restSeconds: 45 },
      { name: "Side-lying leg raise", howTo: "Lie on your side and lift your top leg slowly, then lower it.", sets: all(2), reps: all(12), restSeconds: 30 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 2,
    minutes: all(15),
  },
  ip4: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Nordic hamstring curl", howTo: "Kneel with a partner holding your ankles. Lower your body forward as slowly as you can, catch yourself with your hands and push back up.", sets: all(3), reps: all(5), restSeconds: 90 },
      { name: "Hamstring bridge", howTo: "Lie on your back with your heels on a bench or step, lift your hips and lower slowly.", sets: all(2), reps: all(10), restSeconds: 45 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 2,
    minutes: all(25),
    heavy: true,
  },
  ip5: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Single-leg RDL", howTo: "Stand on one leg holding a dumbbell in the opposite hand. Hinge forward until your body is level with the floor, then stand tall. Finish one leg, then switch.", sets: all(3), reps: all(8), restSeconds: 60 },
      { name: "Single-leg balance", howTo: "Stand on one leg with a slight bend in the knee and keep your hips level.", sets: all(2), seconds: all(30), restSeconds: 30 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 2,
    minutes: all(30),
  },
  final: {
    warmUp: WARM_GYM,
    exercises: [
      { name: "Goblet squat", howTo: "Start with the legs. Thighs level with the floor.", sets: all(3), reps: all(10), restSeconds: 60 },
      { name: "Kettlebell swing", howTo: "Hinge at the hips and snap them forward, arms just guiding it.", sets: all(3), reps: all(15), restSeconds: 60 },
      { name: "Nordic hamstring curl", howTo: "Lower yourself as slowly as you can with a partner holding your ankles.", sets: all(2), reps: all(5), restSeconds: 90 },
      { name: "Plank", howTo: "Finish with a straight-body hold.", sets: all(2), seconds: all(45), restSeconds: 30 },
    ],
    coolDown: COOL_GYM,
    sessionsPerWeek: 2,
    minutes: all(40),

    heavy: true,
  },
};
