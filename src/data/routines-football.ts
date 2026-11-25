import type { PerLevel, Routine } from "../types";

// Training routines for the football tree (#80), one per skill, keyed by skill id. football.ts
// attaches them to its skills. Everything is doable alone with a ball, a wall and a few cones.
// Numbers grow with the player's level: Beginner, Intermediate, Advanced, Expert.

/** Beginner, Intermediate, Advanced, Expert. */
const lv = (beginner: number, intermediate: number, advanced: number, expert: number): PerLevel => ({
  beginner,
  intermediate,
  advanced,
  expert,
});
/** The same number at every level. */
const all = (n: number): PerLevel => lv(n, n, n, n);

const WARM_BALL = "5 minutes: easy jog, leg swings and hip circles, then 20 light touches on the ball with both feet.";
const COOL_BALL = "5 minutes: walk, then stretch calves, hamstrings and hips, 20 seconds each side.";
const WARM_RUN = "8 minutes: easy jog, high knees, heel flicks, side shuffles, then two build-up runs at 70% speed.";
const COOL_RUN = "5 to 8 minutes: easy walk until your breathing settles, then stretch hamstrings, quads and calves.";

export const footballRoutines: Record<string, Routine> = {
  root: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Wall pass and stop", howTo: "Pass against a wall from 5 m and stop the rebound dead with the inside of your foot. Alternate feet.", sets: lv(3, 3, 4, 4), reps: lv(10, 15, 20, 25), restSeconds: 45 },
      { name: "Sole stops", howTo: "Roll the ball a few metres ahead, chase it and stop it under your sole. Alternate feet.", sets: lv(2, 3, 3, 4), reps: lv(10, 12, 15, 20), restSeconds: 30 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 3,
    minutes: lv(20, 25, 30, 30),
  },
  bc1: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Bounce juggles", howTo: "Kick the ball up with your laces, let it bounce once, kick again. Strong foot, then weak foot.", sets: lv(3, 3, 4, 4), seconds: lv(60, 60, 90, 90), restSeconds: 30 },
      { name: "Juggles in a row", howTo: "Juggle with no bounces and count your best run in each set.", sets: lv(4, 5, 5, 6), seconds: lv(60, 60, 90, 120), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 4,
    minutes: lv(15, 20, 20, 25),
  },
  bc2: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Self-throw thigh control", howTo: "Throw the ball above head height and cushion it to the ground with your thigh. Switch legs each set.", sets: lv(3, 3, 4, 4), reps: lv(8, 10, 12, 15), restSeconds: 45 },
      { name: "Wall volley control", howTo: "Kick the ball high against a wall and control the rebound with chest or foot before it bounces twice.", sets: lv(3, 3, 4, 4), reps: lv(8, 10, 12, 15), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 3,
    minutes: lv(20, 25, 25, 30),
  },
  bc3: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Alternating juggles", howTo: "Juggle switching feet on every touch.", sets: all(4), seconds: lv(60, 90, 90, 120), restSeconds: 45 },
      { name: "Thigh and head add-ins", howTo: "Juggle with your feet and add a thigh touch every fifth touch, then a header.", sets: lv(3, 3, 4, 4), seconds: lv(60, 60, 90, 90), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 4,
    minutes: lv(20, 20, 25, 30),
  },
  bc4: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Touch away from the cone", howTo: "Put a cone behind you as a defender. Pass against a wall and take the rebound away from the cone, then dribble 3 m.", sets: lv(3, 4, 4, 5), reps: lv(8, 10, 12, 12), restSeconds: 45 },
      { name: "Check, then turn", howTo: "Look over your shoulder before every rebound, then turn left or right with your first touch.", sets: lv(3, 3, 4, 4), reps: lv(8, 10, 10, 12), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 3,
    minutes: lv(20, 25, 30, 30),
  },
  bc5: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Shielding sole rolls", howTo: "Roll the ball side to side under your sole, knees bent and one arm out, as if a defender is behind you.", sets: lv(3, 3, 4, 4), seconds: lv(30, 45, 45, 60), restSeconds: 30 },
      { name: "Stop and hold", howTo: "Dribble to a cone, stop the ball with your back to the cone and hold it under your sole for 5 seconds.", sets: lv(3, 4, 4, 5), reps: lv(6, 8, 10, 10), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 2,
    minutes: lv(15, 20, 20, 25),
  },
  ps1: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Target passes", howTo: "Pass at a ball-wide target zone on a wall from 10 m. Stop each rebound before the next pass.", sets: lv(3, 4, 4, 5), reps: all(10), restSeconds: 45 },
      { name: "One-touch returns", howTo: "From 6 m, pass the rebound straight back first time with the inside of your foot.", sets: lv(3, 3, 4, 4), reps: lv(10, 15, 20, 20), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 3,
    minutes: lv(20, 25, 30, 30),
  },
  ps2: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Weak-foot target passes", howTo: "The wall target drill from 10 m, weak foot only. Slow down and aim.", sets: lv(4, 5, 5, 6), reps: all(10), restSeconds: 45 },
      { name: "Weak-foot one-touch", howTo: "From 5 m, return every rebound first time with your weak foot.", sets: all(3), reps: lv(10, 12, 15, 20), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 4,
    minutes: lv(20, 25, 25, 30),
  },
  ps3: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Timed wall passes", howTo: "From 5 m, one-touch passes against a wall, alternating feet, for the whole set.", sets: lv(4, 5, 5, 6), seconds: lv(30, 45, 60, 60), restSeconds: 60 },
      { name: "Two-touch tempo", howTo: "Control and pass in two touches as fast as you can, keeping the ball low.", sets: all(3), seconds: lv(30, 45, 45, 60), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 3,
    minutes: lv(20, 25, 25, 30),
  },
  ps4: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Driven passes at a target", howTo: "From 20 to 30 m, strike through the middle of the ball with your laces at a cone or a goal.", sets: lv(3, 3, 4, 4), reps: lv(8, 10, 10, 12), restSeconds: 60 },
      { name: "Keep it low", howTo: "The same strike from 15 m. The ball must not rise above knee height.", sets: all(3), reps: lv(8, 8, 10, 10), restSeconds: 60 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 2,
    minutes: lv(25, 30, 30, 35),
  },
  ps5: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Lofted passes into a box", howTo: "Mark a 5 m box 30 to 40 m away and loft balls into it. Fetch them in batches.", sets: lv(3, 3, 4, 4), reps: lv(8, 8, 10, 10), restSeconds: 60 },
      { name: "Approach and plant", howTo: "Practise the curved run-up and planting your standing foot, first without the ball, then from 20 m.", sets: all(2), reps: lv(8, 10, 10, 10), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 2,
    minutes: lv(25, 30, 35, 35),
  },
  dr1: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Slalom runs", howTo: "6 cones 1 m apart. Dribble through and back using both feet, touching the ball every step.", sets: lv(4, 5, 6, 6), reps: lv(3, 3, 4, 4), restSeconds: 60 },
      { name: "Inside only, outside only", howTo: "The same slalom using only the inside of your feet, then only the outside.", sets: all(3), reps: all(2), restSeconds: 60 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 3,
    minutes: lv(20, 25, 25, 30),
  },
  dr2: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Zigzag cuts", howTo: "Dribble in a zigzag through cones, cutting with the inside, then the outside of the same foot.", sets: lv(3, 4, 4, 5), reps: lv(3, 4, 4, 5), restSeconds: 60 },
      { name: "One-foot slalom", howTo: "Dribble the slalom with your right foot only, then your left foot only.", sets: all(3), reps: all(2), restSeconds: 60 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 3,
    minutes: lv(20, 25, 30, 30),
  },
  dr3: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Standing step-overs", howTo: "Step over the ball on the spot, alternating feet, to get the rhythm.", sets: all(3), seconds: lv(20, 30, 30, 45), restSeconds: 30 },
      { name: "Step-over at a cone", howTo: "Run at a cone, step over, push the ball the other way and accelerate for 5 m.", sets: lv(3, 4, 4, 5), reps: lv(6, 8, 8, 10), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 3,
    minutes: lv(20, 25, 25, 30),
  },
  dr4: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Cruyff turns", howTo: "Dribble at a cone, fake a pass, drag the ball behind your standing leg and go. Both feet.", sets: lv(3, 4, 4, 5), reps: lv(6, 8, 8, 10), restSeconds: 45 },
      { name: "Drag-backs", howTo: "Pull the ball back with your sole and turn away, alternating feet.", sets: all(3), reps: lv(8, 10, 10, 12), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 3,
    minutes: lv(20, 25, 25, 30),
  },
  dr5: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Beat the cone", howTo: "Dribble at a cone at speed, use a move to go past it on either side, then dribble through a 2 m gate.", sets: lv(3, 4, 4, 5), reps: lv(6, 8, 8, 10), restSeconds: 60 },
      { name: "Change of pace", howTo: "Dribble slowly for 5 m, then explode past a cone and keep going for 10 m.", sets: all(3), reps: lv(5, 6, 6, 8), restSeconds: 60 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 2,
    minutes: lv(25, 30, 30, 35),
  },
  sh1: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Corner finishes", howTo: "From the penalty spot, side-foot shots into marked bottom corners.", sets: lv(3, 4, 4, 5), reps: all(10), restSeconds: 60 },
      { name: "Call it, then hit it", howTo: "Say the corner out loud before each shot, then hit that corner.", sets: all(2), reps: all(10), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 3,
    minutes: lv(20, 25, 30, 30),
  },
  sh2: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Laces shots", howTo: "From 18 m, strike through the ball with your laces, aiming low.", sets: lv(3, 3, 4, 4), reps: lv(8, 10, 10, 12), restSeconds: 60 },
      { name: "Technique strikes", howTo: "Short run-up from 10 m: head over the ball, toe down, land on your kicking foot.", sets: all(2), reps: all(10), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 2,
    minutes: lv(25, 30, 30, 35),
  },
  sh3: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Weak-foot corners", howTo: "Side-foot shots into the bottom corners from 12 m, weak foot only.", sets: lv(4, 4, 5, 5), reps: all(10), restSeconds: 60 },
      { name: "Weak-foot touch and shoot", howTo: "Push the ball out of your feet with your weak foot, then shoot with it.", sets: all(3), reps: lv(8, 8, 10, 10), restSeconds: 60 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 3,
    minutes: lv(20, 25, 30, 30),
  },
  sh4: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Wall rebound finishes", howTo: "Pass firmly against a wall at an angle and shoot the rebound first time at a goal or target.", sets: lv(3, 4, 4, 5), reps: lv(8, 10, 10, 12), restSeconds: 60 },
      { name: "Rolling ball shots", howTo: "Roll the ball ahead of you and shoot without stopping it.", sets: all(3), reps: all(10), restSeconds: 60 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 2,
    minutes: lv(25, 25, 30, 35),
  },
  sh5: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Drop volleys", howTo: "Drop the ball from your hands and volley it at a target before it bounces.", sets: lv(3, 4, 4, 5), reps: lv(8, 10, 10, 12), restSeconds: 60 },
      { name: "Wall volleys", howTo: "Throw the ball against a wall and volley the rebound.", sets: all(3), reps: lv(8, 8, 10, 10), restSeconds: 60 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 2,
    minutes: lv(20, 25, 25, 30),
  },
  df1: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Jockey zigzag", howTo: "Side-on, knees bent, shuffle backwards in a zigzag through cones without crossing your feet.", sets: lv(3, 4, 5, 5), reps: lv(3, 4, 4, 5), restSeconds: 60 },
      { name: "Stance holds", howTo: "Hold the defensive stance on your toes, shuffling 2 m left or right every few seconds.", sets: all(3), seconds: lv(30, 30, 45, 45), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 3,
    minutes: lv(15, 20, 25, 25),
  },
  df2: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Mirror shuffles", howTo: "Shuffle between two cones 5 m apart, staying side-on, as fast as you can with good form.", sets: lv(3, 4, 4, 5), seconds: lv(20, 30, 30, 40), restSeconds: 45 },
      { name: "Backpedal and turn", howTo: "Backpedal 5 m, turn your hips and sprint 5 m. Turn both ways.", sets: all(3), reps: lv(4, 6, 6, 8), restSeconds: 60 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 2,
    minutes: lv(20, 20, 25, 30),
  },
  df4: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Self-toss headers", howTo: "Toss the ball up and head it up and away with your forehead, eyes open. Use a lighter ball while you learn, and stop at 10 headers.", sets: all(2), reps: all(5), restSeconds: 60 },
      { name: "Neck strength", howTo: "Put your hands on your forehead and push gently while keeping your neck still. Then the back of your head.", sets: all(3), seconds: lv(10, 15, 15, 20), restSeconds: 30 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 2,
    minutes: lv(10, 15, 15, 15),
  },
  df3: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Block tackle on a still ball", howTo: "Plant your foot beside the ball and drive through it with the inside of your foot, body weight behind it.", sets: all(3), reps: lv(8, 10, 10, 12), restSeconds: 45 },
      { name: "Approach and set", howTo: "Jog at a ball 5 m away, slow down, get side-on and block it.", sets: all(3), reps: lv(6, 8, 8, 10), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 2,
    minutes: lv(15, 20, 20, 25),
  },
  df5: {
    warmUp: WARM_BALL,
    exercises: [
      { name: "Reaction steps", howTo: "Stand between two cones. On a random beep from a phone timer, step and stretch to one side.", sets: lv(3, 4, 4, 5), seconds: lv(20, 30, 30, 40), restSeconds: 45 },
      { name: "Wall interceptions", howTo: "Kick the ball at an angle against a wall and step across to cut out the rebound.", sets: all(3), reps: lv(8, 10, 10, 12), restSeconds: 45 },
    ],
    coolDown: COOL_BALL,
    sessionsPerWeek: 2,
    minutes: lv(15, 20, 20, 25),
  },
  ft1: {
    warmUp: WARM_RUN,
    exercises: [
      { name: "Easy run", howTo: "Run at a pace where you can still talk.", sets: all(1), seconds: lv(900, 1200, 1500, 1800), restSeconds: 0 },
      { name: "Run-walk intervals", howTo: "Run 3 minutes, walk 1 minute.", sets: lv(3, 4, 5, 6), seconds: all(180), restSeconds: 60 },
    ],
    coolDown: COOL_RUN,
    sessionsPerWeek: 3,
    minutes: lv(25, 30, 35, 40),
    heavy: true,
  },
  ft2: {
    warmUp: WARM_RUN,
    exercises: [
      { name: "10 m starts", howTo: "Sprint 10 m from standing, then walk back.", sets: all(1), reps: lv(6, 8, 8, 10), restSeconds: 60 },
      { name: "30 m sprints", howTo: "Sprint 30 m at full speed, then walk back slowly.", sets: all(1), reps: lv(3, 4, 5, 6), restSeconds: 120 },
    ],
    coolDown: COOL_RUN,
    sessionsPerWeek: 2,
    minutes: lv(20, 25, 25, 30),
    heavy: true,
  },
  ft3: {
    warmUp: WARM_RUN,
    exercises: [
      { name: "T-test runs", howTo: "Cones in a T: 10 m forward, 5 m each side. Sprint, shuffle left, shuffle right, back.", sets: all(1), reps: lv(4, 5, 6, 6), restSeconds: 90 },
      { name: "Lateral shuffles", howTo: "Shuffle 5 m left and right between two cones as fast as you can.", sets: lv(3, 3, 4, 4), seconds: lv(15, 20, 20, 25), restSeconds: 45 },
    ],
    coolDown: COOL_RUN,
    sessionsPerWeek: 2,
    minutes: lv(20, 20, 25, 25),
    heavy: true,
  },
  ft4: {
    warmUp: WARM_RUN,
    exercises: [
      { name: "40 m repeats", howTo: "Sprint 40 m, rest 30 seconds, repeat.", sets: all(1), reps: lv(6, 8, 10, 12), restSeconds: 30 },
    ],
    coolDown: COOL_RUN,
    sessionsPerWeek: 2,
    minutes: lv(20, 25, 25, 30),
    heavy: true,
  },
  ft5: {
    warmUp: WARM_RUN,
    exercises: [
      { name: "Tempo run", howTo: "Run at a steady, comfortably hard pace.", sets: all(1), seconds: lv(1200, 1500, 1500, 1500), restSeconds: 0 },
      { name: "Sprint bursts", howTo: "During the run, sprint for 20 seconds every 3 minutes.", sets: all(1), reps: lv(4, 6, 8, 10), restSeconds: 0 },
    ],
    coolDown: COOL_RUN,
    sessionsPerWeek: 2,
    minutes: lv(35, 40, 40, 45),
    heavy: true,
  },
  final: {
    warmUp: WARM_RUN,
    exercises: [
      { name: "Skill circuit", howTo: "One round: 20 juggles, 10 wall passes, a cone slalom and 5 shots. Rest, then go again.", sets: lv(2, 3, 3, 4), reps: all(1), restSeconds: 120 },
      { name: "Small-sided game", howTo: "Play a small game with friends and try to use one skill from every branch.", sets: all(1), seconds: lv(1200, 1800, 1800, 2400), restSeconds: 0 },
    ],
    coolDown: COOL_RUN,
    sessionsPerWeek: 2,
    minutes: lv(40, 50, 55, 60),
  },
};
