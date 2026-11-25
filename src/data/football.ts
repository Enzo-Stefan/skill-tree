import type { Tree } from "../types";
import { footballRoutines } from "./routines-football";

// Football tree content. Edit drills, tests and tips here.
// Run `npm run check-trees` after editing.

const footballContent: Tree = {
  "id": "football",
  "title": "hapi skill",
  "shortName": "Football",
  "tagline": "Tap a skill, pass its test, unlock the next one.",
  "branches": [
    {
      "id": "bc",
      "name": "Ball Control",
      "color": "#7cc6fe"
    },
    {
      "id": "ps",
      "name": "Passing",
      "color": "#f2c14e"
    },
    {
      "id": "dr",
      "name": "Dribbling",
      "color": "#ff9a62"
    },
    {
      "id": "sh",
      "name": "Shooting",
      "color": "#ff6b81"
    },
    {
      "id": "df",
      "name": "Defending",
      "color": "#a99bff"
    },
    {
      "id": "ft",
      "name": "Fitness",
      "color": "#5fd39a"
    }
  ],
  "skills": [
    {
      "id": "root",
      "branch": null,
      "name": "First Touch",
      "requires": [],
      "x": 5.5,
      "row": 0,
      "drill": "Have a friend roll the ball to you from 10 metres, or pass it against a wall. Stop it with the inside of your foot so it stays close.",
      "video": "https://www.youtube.com/watch?v=Z5_-hV5oc1s",
      "test": "Stop 10 rolled passes in a row. Each one must stay within one step of you.",
      "check": { "kind": "count", "needed": 10, "inARow": true },
      "tip": "Pull your foot back a little as the ball arrives. A soft foot kills the ball. A stiff foot bounces it away."
    },
    {
      "id": "bc1",
      "branch": "bc",
      "name": "Juggle 20",
      "requires": [
        "root"
      ],
      "x": 0.5,
      "row": 1,
      "drill": "Drop the ball onto your strong foot and keep it up with your laces. Start by letting it bounce once between touches if you need to.",
      "video": "https://www.youtube.com/watch?v=bH3vhjIGgpQ",
      "test": "20 juggles in a row, feet only, no bounces.",
      "check": { "kind": "count", "needed": 20, "inARow": true },
      "tip": "Keep your ankle locked and toes slightly up. Small touches to waist height are easier than big ones."
    },
    {
      "id": "bc2",
      "branch": "bc",
      "name": "Cushion High Balls",
      "requires": [
        "bc1"
      ],
      "x": 0,
      "row": 2,
      "drill": "A partner throws the ball to you from 10 metres. Control it with your thigh, chest or foot and get it to the ground.",
      "video": "https://www.youtube.com/watch?v=l9f9Lo29sAQ",
      "test": "Control 8 of 10 throws so the ball drops within one step of you.",
      "check": { "kind": "hits", "needed": 8, "attempts": 10 },
      "tip": "Relax the body part the ball hits, like catching an egg."
    },
    {
      "id": "bc3",
      "branch": "bc",
      "name": "Juggle 50, Both Feet",
      "requires": [
        "bc1"
      ],
      "x": 1,
      "row": 2,
      "drill": "Juggle while switching feet every touch. Then add thighs and head.",
      "video": "https://www.youtube.com/watch?v=4C4lyuaquKI",
      "test": "50 juggles in a row, using both feet at least 15 times each.",
      "check": { "kind": "count", "needed": 50, "inARow": true },
      "tip": "Count out loud. It keeps your rhythm steady."
    },
    {
      "id": "bc4",
      "branch": "bc",
      "name": "Directional Touch",
      "requires": [
        "bc2"
      ],
      "x": 0,
      "row": 3,
      "drill": "Place a cone behind you as a fake defender. Receive a pass and use your first touch to move the ball away from the cone into space.",
      "video": "https://www.youtube.com/watch?v=PpukTlNw6GM",
      "test": "8 of 10 first touches go at least 2 metres into space, away from the cone.",
      "check": { "kind": "hits", "needed": 8, "attempts": 10 },
      "tip": "Check your shoulder before the ball arrives so you know where the space is."
    },
    {
      "id": "bc5",
      "branch": "bc",
      "name": "Shield the Ball",
      "requires": [
        "bc4",
        "bc3"
      ],
      "x": 0.5,
      "row": 4,
      "drill": "Stand with your back to a teammate. Keep the ball under your sole while they try to win it.",
      "video": "https://www.youtube.com/watch?v=BfxjIFJoU7M",
      "test": "Keep the ball for 10 seconds in 4 of 5 rounds.",
      "check": { "kind": "hits", "needed": 4, "attempts": 5, "seconds": 10 },
      "tip": "Bend your knees, arm out, body between the defender and the ball."
    },
    {
      "id": "ps1",
      "branch": "ps",
      "name": "Inside-Foot Pass",
      "requires": [
        "root"
      ],
      "x": 2.5,
      "row": 1,
      "drill": "Mark a target zone one ball wide on a wall. Pass to it from 10 metres with your strong foot.",
      "video": "https://www.youtube.com/watch?v=MO73sagJ2ak",
      "test": "8 of 10 passes hit the target zone from 10 metres.",
      "check": { "kind": "hits", "needed": 8, "attempts": 10 },
      "tip": "Plant your standing foot next to the ball, pointing at the target."
    },
    {
      "id": "ps2",
      "branch": "ps",
      "name": "Weak-Foot Pass",
      "requires": [
        "ps1"
      ],
      "x": 2,
      "row": 2,
      "drill": "Same wall drill, weak foot only. Do 50 a day for a week.",
      "video": "https://www.youtube.com/watch?v=4DYAxGMg0jo",
      "test": "7 of 10 weak-foot passes hit the target zone from 10 metres.",
      "check": { "kind": "hits", "needed": 7, "attempts": 10 },
      "tip": "Slow down. Accuracy first, power later."
    },
    {
      "id": "ps3",
      "branch": "ps",
      "name": "One-Touch Wall Passes",
      "requires": [
        "ps1"
      ],
      "x": 3,
      "row": 2,
      "drill": "Stand 5 metres from a wall. Pass back every rebound first time, alternating feet.",
      "video": "https://www.youtube.com/watch?v=_9WerPtlwIk",
      "test": "40 clean one-touch passes in 60 seconds, without the ball stopping.",
      "check": { "kind": "count", "needed": 40, "seconds": 60 },
      "tip": "Stay on your toes so you are ready for a bad bounce."
    },
    {
      "id": "ps4",
      "branch": "ps",
      "name": "Driven Pass 30m",
      "requires": [
        "ps2"
      ],
      "x": 2,
      "row": 3,
      "drill": "Strike through the middle of the ball with your laces so it travels low and fast to a partner 30 metres away.",
      "video": "https://www.youtube.com/watch?v=lDtl9gjFvj0",
      "test": "6 of 10 passes reach your partner without going above head height.",
      "check": { "kind": "hits", "needed": 6, "attempts": 10 },
      "tip": "Lean over the ball and land on your kicking foot after the strike."
    },
    {
      "id": "ps5",
      "branch": "ps",
      "name": "Long Switch 40m",
      "requires": [
        "ps4",
        "ps3"
      ],
      "x": 2.5,
      "row": 4,
      "drill": "Hit lofted passes across the pitch to a partner standing in a 5 metre box.",
      "video": "https://www.youtube.com/watch?v=bV_n-pw6shw",
      "test": "5 of 10 passes land in the box from 40 metres.",
      "check": { "kind": "hits", "needed": 5, "attempts": 10 },
      "tip": "Hit under the middle of the ball and lean back slightly."
    },
    {
      "id": "dr1",
      "branch": "dr",
      "name": "Cone Slalom",
      "requires": [
        "root"
      ],
      "x": 4.5,
      "row": 1,
      "drill": "Set 6 cones in a line, 1 metre apart. Dribble through and back using both feet.",
      "video": "https://www.youtube.com/watch?v=vnngDOCy9C8",
      "test": "There and back in under 15 seconds without touching a cone.",
      "check": { "kind": "time", "under": 15 },
      "tip": "Touch the ball every step. More touches means more control."
    },
    {
      "id": "dr2",
      "branch": "dr",
      "name": "Inside-Outside Cuts",
      "requires": [
        "dr1"
      ],
      "x": 4,
      "row": 2,
      "drill": "Dribble in a zigzag, cutting the ball with the inside of your foot and then the outside of the same foot.",
      "video": "https://www.youtube.com/watch?v=AlMwNGOmkwA",
      "test": "Complete the slalom using only one foot in under 18 seconds, then repeat with the other foot.",
      "check": { "kind": "time", "under": 18, "perSide": true },
      "tip": "Drop your hips as you cut. It makes the change of direction sharper."
    },
    {
      "id": "dr3",
      "branch": "dr",
      "name": "Step-Over",
      "requires": [
        "dr1"
      ],
      "x": 5,
      "row": 2,
      "drill": "Run at a cone, circle your foot around the ball, then push the ball the other way.",
      "video": "https://www.youtube.com/watch?v=y1UJrlWu7J8",
      "test": "8 of 10 step-overs at running speed, going past the cone on the correct side.",
      "check": { "kind": "hits", "needed": 8, "attempts": 10 },
      "tip": "Sell it with your shoulders. Defenders watch your hips, not your feet."
    },
    {
      "id": "dr4",
      "branch": "dr",
      "name": "Cruyff and Drag-Back",
      "requires": [
        "dr2"
      ],
      "x": 4,
      "row": 3,
      "drill": "Dribble at a cone. Fake a pass, then drag the ball behind your standing leg and turn away.",
      "video": "https://www.youtube.com/watch?v=RbHfV-R4UAc",
      "test": "8 of 10 turns done cleanly at jogging speed with both feet.",
      "check": { "kind": "hits", "needed": 8, "attempts": 10 },
      "tip": "The fake pass has to look real. Swing your leg like you mean it."
    },
    {
      "id": "dr5",
      "branch": "dr",
      "name": "Win the 1v1",
      "requires": [
        "dr4",
        "dr3"
      ],
      "x": 4.5,
      "row": 4,
      "drill": "Play 1v1 against a teammate in a 10 by 15 metre box. Score by dribbling over their end line.",
      "video": "https://www.youtube.com/watch?v=zdAQCqF0ayg",
      "test": "Win 5 of 10 one-on-ones.",
      "check": { "kind": "hits", "needed": 5, "attempts": 10 },
      "tip": "Attack the defender's front foot. They have to turn to stop you."
    },
    {
      "id": "sh1",
      "branch": "sh",
      "name": "Placed Finish",
      "requires": [
        "root"
      ],
      "x": 6.5,
      "row": 1,
      "drill": "Mark the two bottom corners of a goal. Side-foot shots into them from the penalty spot.",
      "video": "https://www.youtube.com/watch?v=U3JmkMLaclM",
      "test": "7 of 10 shots go into a corner zone from 12 metres.",
      "check": { "kind": "hits", "needed": 7, "attempts": 10 },
      "tip": "Pick your corner before you shoot, then don't change your mind."
    },
    {
      "id": "sh2",
      "branch": "sh",
      "name": "Laces Strike",
      "requires": [
        "sh1"
      ],
      "x": 6,
      "row": 2,
      "drill": "Hit shots with your laces from the edge of the box, aiming for power and staying low.",
      "video": "https://www.youtube.com/watch?v=09T73oLUsQk",
      "test": "6 of 10 shots on target from 18 metres.",
      "check": { "kind": "hits", "needed": 6, "attempts": 10 },
      "tip": "Head over the ball, toe pointed down, follow through towards the goal."
    },
    {
      "id": "sh3",
      "branch": "sh",
      "name": "Weak-Foot Finish",
      "requires": [
        "sh1"
      ],
      "x": 7,
      "row": 2,
      "drill": "Repeat the placed finish drill with your weak foot only.",
      "video": "https://www.youtube.com/watch?v=G45gulmcfXE",
      "test": "6 of 10 weak-foot shots go into a corner zone from 12 metres.",
      "check": { "kind": "hits", "needed": 6, "attempts": 10 },
      "tip": "Most keepers expect your strong foot. A good weak foot wins games."
    },
    {
      "id": "sh4",
      "branch": "sh",
      "name": "First-Time Finish",
      "requires": [
        "sh2"
      ],
      "x": 6,
      "row": 3,
      "drill": "A partner rolls the ball across from the side. Shoot first time without stopping it.",
      "video": "https://www.youtube.com/watch?v=xXCaL8Exrn4",
      "test": "6 of 10 first-time shots on target from 12 metres.",
      "check": { "kind": "hits", "needed": 6, "attempts": 10 },
      "tip": "Open your body towards the goal before the ball arrives."
    },
    {
      "id": "sh5",
      "branch": "sh",
      "name": "Volley",
      "requires": [
        "sh4",
        "sh3"
      ],
      "x": 6.5,
      "row": 4,
      "drill": "A partner throws the ball up from 5 metres. Volley it at goal before it bounces.",
      "video": "https://www.youtube.com/watch?v=QC1uKiRWYCw",
      "test": "5 of 10 volleys on target from 12 metres.",
      "check": { "kind": "hits", "needed": 5, "attempts": 10 },
      "tip": "Watch the ball onto your foot and keep your knee over it."
    },
    {
      "id": "df1",
      "branch": "df",
      "name": "Defensive Stance",
      "requires": [
        "root"
      ],
      "x": 8.5,
      "row": 1,
      "drill": "Stand side-on, knees bent, weight on your toes. Shuffle backwards and sideways without crossing your feet.",
      "video": "https://www.youtube.com/watch?v=N4EChliBbFc",
      "test": "Jockey backwards 10 metres and back in a zigzag without crossing your feet once.",
      "check": { "kind": "done" },
      "tip": "Show the attacker towards the touchline, away from goal."
    },
    {
      "id": "df2",
      "branch": "df",
      "name": "Jockey and Delay",
      "requires": [
        "df1"
      ],
      "x": 8,
      "row": 2,
      "drill": "A teammate tries to dribble past you over a line. Your job is only to slow them down.",
      "video": "https://www.youtube.com/watch?v=hgrStIbFls0",
      "test": "Stop the attacker crossing the line for 6 seconds, 7 of 10 times.",
      "check": { "kind": "hits", "needed": 7, "attempts": 10, "seconds": 6 },
      "tip": "Stay an arm's length away. Too close and they go past you."
    },
    {
      "id": "df4",
      "branch": "df",
      "name": "Heading Clearance",
      "requires": [
        "df1"
      ],
      "x": 9,
      "row": 2,
      "drill": "A partner throws the ball high to you. Head it up and away using your forehead. Keep it to 10 headers a session, and use a lighter ball while you learn.",
      "video": "https://www.youtube.com/watch?v=FDVQy7TBxRc",
      "test": "Head 8 of 10 throws at least 10 metres.",
      "check": { "kind": "hits", "needed": 8, "attempts": 10 },
      "tip": "Eyes open, neck firm, attack the ball instead of waiting for it."
    },
    {
      "id": "df3",
      "branch": "df",
      "name": "Clean Tackle",
      "requires": [
        "df2"
      ],
      "x": 8,
      "row": 3,
      "drill": "Practise block tackles against a teammate dribbling at walking speed, then jogging.",
      "video": "https://www.youtube.com/watch?v=IQQI40vTqtQ",
      "test": "Win the ball cleanly 6 of 10 times with no fouls.",
      "check": { "kind": "hits", "needed": 6, "attempts": 10 },
      "tip": "Tackle with the inside of your foot and put your body weight through it."
    },
    {
      "id": "df5",
      "branch": "df",
      "name": "Read and Intercept",
      "requires": [
        "df3",
        "df4"
      ],
      "x": 8.5,
      "row": 4,
      "drill": "Play 3 against 1 in a 10 by 10 metre square. You are the 1. Try to step in and cut out passes.",
      "video": "https://www.youtube.com/watch?v=lpSfgT0Xf54",
      "test": "Intercept 5 passes in 2 minutes.",
      "check": { "kind": "count", "needed": 5, "seconds": 120 },
      "tip": "Watch the passer's hips. They point where the ball is going."
    },
    {
      "id": "ft1",
      "branch": "ft",
      "name": "3 km Run",
      "requires": [
        "root"
      ],
      "x": 10.5,
      "row": 1,
      "drill": "Run at an easy pace 3 times a week. Build up from 1 km.",
      "video": "https://www.youtube.com/watch?v=sScNDZu2MWk",
      "test": "Run 3 km without stopping.",
      "check": { "kind": "done" },
      "tip": "If you can't talk while running, you are going too fast."
    },
    {
      "id": "ft2",
      "branch": "ft",
      "name": "Explosive Starts",
      "requires": [
        "ft1"
      ],
      "x": 10,
      "row": 2,
      "drill": "Sprint 10 metres from standing, 8 times, with full rest between.",
      "video": "https://www.youtube.com/watch?v=9FLbl9uVGXw",
      "test": "Sprint 30 metres from standing, timed by a friend, best of 3 tries.",
      "check": { "kind": "time", "tries": 3 },
      "targets": {
        "text": "Under {n} seconds.",
        "values": { "beginner": 5.8, "intermediate": 5.3, "advanced": 4.8, "expert": 4.55 }
      },
      "tip": "Drive your arms. Your legs follow your arms."
    },
    {
      "id": "ft3",
      "branch": "ft",
      "name": "Agility T-Test",
      "requires": [
        "ft1"
      ],
      "x": 11,
      "row": 2,
      "drill": "Set cones in a T shape: 10 metres forward, 5 metres each side. Sprint, shuffle left, shuffle right, back.",
      "video": "https://www.youtube.com/watch?v=_dqa4rkjzpg",
      "test": "Finish the T-test in under 11 seconds.",
      "check": { "kind": "time", "under": 11 },
      "tip": "Stay low on the turns and plant your outside foot."
    },
    {
      "id": "ft4",
      "branch": "ft",
      "name": "Repeat Sprints",
      "requires": [
        "ft2"
      ],
      "x": 10,
      "row": 3,
      "drill": "Sprint 40 metres, rest 30 seconds, repeat.",
      "video": "https://www.youtube.com/watch?v=e3iXwU_xk5M",
      "test": "10 sprints of 40 metres with 30 seconds rest between, each one under your target time.",
      "check": { "kind": "time", "reps": 10 },
      "targets": {
        "text": "Each sprint under {n} seconds.",
        "values": { "beginner": 7.5, "intermediate": 7.0, "advanced": 6.5, "expert": 6.25 }
      },
      "tip": "Walk back slowly during the rest to recover faster."
    },
    {
      "id": "ft5",
      "branch": "ft",
      "name": "Last 90 Minutes",
      "requires": [
        "ft4",
        "ft3"
      ],
      "x": 10.5,
      "row": 4,
      "drill": "Mix a 5 km run with sprint intervals once a week.",
      "video": "https://www.youtube.com/watch?v=-nq4VftyyYs",
      "test": "Run 5 km in under 25 minutes.",
      "check": { "kind": "time", "under": 1500 },
      "tip": "Sleep and water matter as much as the training."
    },
    {
      "id": "final",
      "branch": null,
      "name": "Match Ready",
      "requires": [
        "bc5",
        "ps5",
        "dr5",
        "sh5",
        "df5",
        "ft5"
      ],
      "x": 5.5,
      "row": 5,
      "drill": "Play full matches and use every skill you unlocked. Film a game if you can and watch it back.",
      "test": "Play a full 90-minute match and use at least 1 skill from every branch in it.",
      "check": { "kind": "done" },
      "tip": "This is where the work pays off. Enjoy it.",
      "big": true
    }
  ],
  "playerLevels": [
    { "id": "beginner", "name": "Beginner", "hint": "New to football or just starting to train" },
    { "id": "intermediate", "name": "Intermediate", "hint": "Play regularly for a school or local team" },
    { "id": "advanced", "name": "Advanced", "hint": "Play at a high club or academy level" },
    { "id": "expert", "name": "Expert", "hint": "Semi-pro level or above" }
  ],
  "levels": [
    {
      "at": 0,
      "name": "Sunday League"
    },
    {
      "at": 6,
      "name": "Academy"
    },
    {
      "at": 13,
      "name": "Semi-Pro"
    },
    {
      "at": 20,
      "name": "Pro"
    },
    {
      "at": 27,
      "name": "First Team"
    },
    {
      "at": 32,
      "name": "Legend"
    }
  ]
};

/** The football tree, with each skill's training routine (#80) from routines-football.ts. */
export const football: Tree = {
  ...footballContent,
  skills: footballContent.skills.map((s) => ({ ...s, routine: footballRoutines[s.id] })),
};
