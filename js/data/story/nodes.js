
export const story = {
  start: {
    chapter: "Prologue",
    text: `You wake in a cold, wet clearing behind the school oval.
Something burned a shallow trench into the grass.

Half-buried in mud is a small robot — not much bigger than a backpack.
Its eye lens flickers once… then locks on to you.

It speaks in a calm, clipped voice:
"HELLO. I AM K-0R. YOUR PLANET IS… INEFFICIENT."`,
    choices: [
      { text: "Help it upright", next: "kor_upright" },
      { text: "Back away (watch it from a distance)", next: "kor_distance" }
    ]
  },

  kor_upright: {
    chapter: "Prologue",
    text: `You grab the robot under its chassis and heave.
It’s heavier than it looks.

K-0R steadies, scans the trees, then the sky.

"PRIMARY OBJECTIVE: ESTABLISH A GATE. I REQUIRE TITANIUM."`,
    choices: [
      { text: "Ask what it means by 'Gate'", next: "gate_explain" },
      { text: "Agree to help (it feels wrong not to)", next: "gate_explain" }
    ]
  },

  kor_distance: {
    chapter: "Prologue",
    text: `You keep your distance.
The robot doesn't chase you. It simply… waits.

Then, as if hearing something you can't, it turns its head and says:
"PRIMARY OBJECTIVE: ESTABLISH A GATE. I REQUIRE TITANIUM."`,
    choices: [
      { text: "Approach anyway", next: "gate_explain" },
      { text: "Run back toward the school", next: "gate_explain" }
    ]
  },

  gate_explain: {
    chapter: "Prologue",
    text: `K-0R draws shapes in the dirt with a broken twig.
A ring. A brace. A lattice that makes your stomach twist to look at.

"A GATE ALLOWS ACCESS TO A SAFE EXTRA-LOCAL VOLUME.
A PLACE TO GATHER MATERIALS WITHOUT BEING OBSERVED.

TITANIUM IS THE BASE STRUCTURE.
WITHOUT IT, THE FRAME FAILS."`,
    choices: [
      {
        text: "Start building the frame (spend Titanium)",
        next: "gate_frame",
        requires: { ti: 10 },
        spend: { ti: 10 }
      },
      { text: "Not yet — gather first", next: "start" }
    ]
  },

  gate_frame: {
    chapter: "Prologue",
    text: `You hand over the titanium. K-0R's hands move too fast to follow.
The pieces fold into a skeletal ring — not active, but… waiting.

"GOOD. NEXT: STABILITY MATERIALS. YOU REQUIRE STORAGE."`,
    choices: [
      { text: "K-0R suggests buying a backpack", next: "bp_hint" },
      { text: "Ignore the advice and keep gathering", next: "start" }
    ]
  },

  bp_hint: {
    chapter: "Prologue",
    text: `K-0R tilts its head, then projects a simple store listing into the air — "Backpack Mk.I" with a price tag beside it.

"YOUR BIOLOGICAL LIMITATION IS CARRYING CAPACITY.
ACQUIRE STORAGE. PURCHASE AT THE GENERAL STORE."`,
    choices: [
      { text: "Return to gathering", next: "start" }
    ]
  },

    // -----------------------------
// SIDE QUEST: MONSTER BRAWL (Vulkraine beats)
// -----------------------------
sq_monster_intro: {
  chapter: "EVENT: Monster brawl",
    bg: "./assets/sprites/bg/vulkraine_bridge_bg.png",
  chars: [
    { id: "Colt", src: "./assets/sprites/chars/colt/neutral.png", pos: "center", scale: 0.85 },
    { id: "Jackson", src: "./assets/sprites/chars/jackson/jackson-resolve.png", pos: "right", scale: 1.05 }
  ],
beats: [
    "The Vulkraine world is a desolate wasteland, shrouded in fire and molten lava. Vast volcanoes sound in the distance like rockets.",
    { speaker: "Victoria", text: "It's too hot here! We're going to melt." },
    { speaker: "Colt", text: "Hold your nose and breathe through your mouth. You'll last longer." }
  ],
  // Click after the final beat to continue automatically
  autoNext: "sq_vulkraine_minion"
},

sq_vulkraine_minion: {
  chapter: "EVENT: Monster brawl",
  bg: "./assets/sprites/bg/vulkraine_bridge_bg.png",
  chars: [
    { id: "Colt", src: "./assets/sprites/chars/colt/neutral.png", pos: "left", scale: 0.85 },
    { id: "Jackson", src: "./assets/sprites/chars/jackson/jackson-resolve.png", pos: "right", scale: 1.08 },
    { id: "Minion", src: "./assets/sprites/minion.svg", pos: "center", scale: 0.70 }
  ],
beats: [
    "A Vulkraine minion appears from the heat haze. It looks focused on you and ready to fight.",
    { speaker: "Lily", text: "Oh, no!" },
    { speaker: "Jackson", text: "Stay behind me. I've got this." },
    "(New) Choose Move / Item / Tech below to fight."
  ],
  choices: [
    { text: "Attack", next: "sq_brawl_battle", action: "start_brawl" },
    { text: "Run", next: "sq_monster_run" }
  ]
},

// Battle scene
sq_brawl_battle: {
  chapter: "EVENT: Monster brawl",
  battle: "monster_brawl",
  // Keep the node lean; UI renders the battle module.
  text: "",
  choices: []
},

// Backwards-compat: older saves/builds may point here.
// Route to the correct outcome based on current HP.
sq_monster_result: {
  chapter: "EVENT: Monster brawl",
  text: (state) => {
    const hp = state?.player?.hp ?? 0;
    return hp <= 0
      ? "The heat swallows your vision…"
      : "The brawl ends in a haze of ash.";
  },
  choices: (state) => {
    const hp = state?.player?.hp ?? 0;
    return [{
      text: "Continue",
      next: (hp <= 0) ? "sq_monster_defeat" : "sq_monster_complete"
    }];
  }
},

// Combat loop node expected by the combat system.
// Each click on the story frame performs a real combat turn.


  sq_monster_run: {
    chapter: "EVENT: Monster brawl",
    text: `You back out fast. Whatever is down there, it can wait.
For now.`,
    choices: [
      
    ]
  },

  sq_monster_defeat: {
    chapter: "EVENT: Monster brawl",
    text: (state) => `You hit the ground hard.
Your vision swims.

HP: ${state.player.hp}/${state.player.maxHp}

You manage to crawl away before anything finishes the job.`,
    choices: [
      { text: "Leave", next: "choose_adventure", action: "finish_chapter", chapterKey: "event_monster_brawl", result: "defeat" },
      { text: "Wake up later", next: "start" }
    ]
  },

  sq_monster_complete: {
    chapter: "EVENT: Monster brawl",
    beats: [
      "VICTORY",
      "Whatever that was, it won't be the last.",
      "You steady your hands and regain a little health (+2 HP)."
    ],
    choices: [
      { text: "Leave", next: "choose_adventure", action: "finish_chapter", chapterKey: "event_monster_brawl", result: "victory" },
      { text: "Fight again", next: "sq_monster_intro" }
    ]
  },

  // -----------------------------
  // REPEATABLE EVENT: THE JUNKYARD (scrap scavenging)
  // Runs fully inside the Story frame.
  // -----------------------------

  sq_junkyard_intro: {
    chapter: "EVENT: The junkyard",
    bg: "./assets/sprites/bg/junkyard_bg.webp",
    beats: [
      "A chain-link fence sags under its own weight.",
      "Beyond it: twisted metal, sun-bleached plastic, and the faint stink of old oil.",
      "If you keep your eyes sharp, you can usually find *something*."
    ],
    choices: [
      { text: "Scavenge", next: "sq_junkyard_scavenge", action: "start_junkyard" },
      { text: "Leave", next: "choose_adventure", action: "exit_chapter" }
    ]
  },

  // Quick loop node (used after distilling so the event feels endless until you leave).

  sq_junkyard_loop: {
    chapter: "EVENT: The junkyard",
    bg: "./assets/sprites/bg/junkyard_bg.webp",
    beats: [
      "If you keep your eyes sharp, you can usually find *something*."
    ],
    choices: [
      { text: "Scavenge", next: "sq_junkyard_scavenge", action: "start_junkyard" },
      { text: "Leave", next: "choose_adventure", action: "exit_chapter" }
    ]
  },

  // Countdown + result messaging. The 1s tick loop in bootstrap resolves the timer and opens the Loot modal.
  sq_junkyard_scavenge: {
    chapter: "EVENT: The junkyard",
    bg: "./assets/sprites/bg/junkyard_bg.webp",
    text: (state) => {
      const j = state?.jobs?.junkyard;
      const t = Date.now();
      const endAt = Math.max(0, Math.floor(Number(j?.endAt) || 0));
      const active = !!j?.active && endAt > t;

      if (active){
        const s = Math.max(0, Math.ceil((endAt - t) / 1000));
        return `You climb over a pile of scrap and start digging.\n\nScavenging… ${s}s`;
      }

      const distilled = state?.ui?.lastJunkyardDistilled;
      if (distilled?.xpGained !== undefined && distilled?.xpGained !== null){
        const xp = Math.max(0, Number(distilled.xpGained) || 0);
        const xpTxt = (Math.abs(xp - Math.round(xp)) < 1e-9) ? String(Math.round(xp)) : xp.toFixed(2);
        return `XP Gained: ${xpTxt}`;
      }

      const last = state?.ui?.lastJunkyardLoot;
      // Loot is already shown via the Monster-Brawl-style modal.
      // Keep the story frame clean and consistent.
      if (last?.label){
        return "If you keep your eyes sharp, you can usually find *something*.";
      }

      return "You pause, listening. The junkyard is quiet… for now.";
    },
    choices: (state) => {
      const j = state?.jobs?.junkyard;
      const t = Date.now();
      const endAt = Math.max(0, Math.floor(Number(j?.endAt) || 0));
      const active = !!j?.active && endAt > t;

      if (active){
        return [
          { text: "Leave", next: "choose_adventure", action: "exit_chapter" }
        ];
      }

      const distilled = state?.ui?.lastJunkyardDistilled;
      if (distilled?.xpGained !== undefined && distilled?.xpGained !== null){
        return [
          { text: "Continue", next: "sq_junkyard_loop", action: "clear_junkyard_distilled" },
          { text: "Leave", next: "choose_adventure", action: "exit_chapter" }
        ];
      }

      return [
        { text: "Scavenge", next: "sq_junkyard_scavenge", action: "start_junkyard" },
        { text: "Leave", next: "choose_adventure", action: "exit_chapter" }
      ];
    }
  },

      // Hub / Reset screen
      choose_adventure: {
        chapter: "Choose Your Adventure",
        scene: "./assets/sprites/choose_adventure.svg",
        text: ``,
        choices: []
      }

};

export const chapters = [
  { key: "event_monster_brawl", title: "EVENT: Monster brawl", type: "event", repeatable: true, startNodeId: "sq_monster_intro", reward: "Repeatable Lv 1 minion showdown. 8 XP per win. 25% chance to loot Twinstrike Gloves (+1 attack/turn)." },
  { key: "event_junkyard", title: "EVENT: The junkyard", type: "event", repeatable: true, startNodeId: "sq_junkyard_intro", reward: "Repeatable scavenging run. 20s to find 1 scrap. Loot appears like Monster Brawl rewards." },
];
