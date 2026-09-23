/* ============================================================
   VORTRIX — v3 local review generator.
   The reliable CORE of the review flow: pure JavaScript, no
   network, no AI dependency. Analyzes the customer's answers
   (sentiment, praised aspects, their own words) and writes a
   new, natural Google review every time.
   Groq is only a polisher on top — this file never fails.
   ============================================================ */

/* ---- The 8 v3 psychological questions (shared by tap page
        DEMO_CONFIG and the admin app's defaultQuestions). ---- */
var V3_QUESTIONS = [
  { id: "q1", text: "How was your experience?", type: "choice",
    options: ["Loved it", "Pretty good", "It was okay", "Not great"] },
  { id: "q2", text: "What stood out the most?", type: "choice",
    options: ["The quality", "The ambience", "The service", "The value"] },
  { id: "q3", text: "How did the staff treat you?", type: "choice",
    options: ["Like a guest of honour", "Warm and friendly", "Fine, nothing special", "Could've been better"] },
  { id: "q4", text: "Was it worth the money?", type: "choice",
    options: ["Totally worth it", "Fair enough", "A bit pricey", "Not really"] },
  { id: "q5", text: "How did you feel when you left?", type: "choice",
    options: ["Happy and relaxed", "Satisfied", "Just okay", "Disappointed"] },
  { id: "q6", text: "Would you come back?", type: "choice",
    options: ["Definitely", "Probably", "Maybe", "No"] },
  { id: "q7", text: "What would you tell a friend?", type: "choice",
    options: ["You have to try it", "Worth checking out", "It's alright", "I'd skip it"] },
  { id: "q8", text: "Sum it up in one line.", type: "choice",
    options: ["Hidden gem", "Solid and reliable", "Great vibe", "Needs work"] }
];

function v3DefaultQuestions() {
  return JSON.parse(JSON.stringify(V3_QUESTIONS));
}

/* ---- Option metadata: sentiment score + aspect tags.
        q2 feeds aspects only (it is a "what stood out" picker). ---- */
var V3_META = {
  q1: {
    "Loved it":              { s: 2 },
    "Pretty good":           { s: 1 },
    "It was okay":           { s: 0 },
    "Not great":             { s: -2 }
  },
  q2: {
    "The quality":           { s: 1, aspect: "quality" },
    "The ambience":          { s: 1, aspect: "ambience" },
    "The service":           { s: 1, aspect: "service" },
    "The value":             { s: 1, aspect: "value" }
  },
  q3: {
    "Like a guest of honour": { s: 2, aspect: "staff" },
    "Warm and friendly":      { s: 1, aspect: "staff" },
    "Fine, nothing special":  { s: 0 },
    "Could've been better":   { s: -1, aspect: "staff" }
  },
  q4: {
    "Totally worth it":      { s: 2, aspect: "value" },
    "Fair enough":           { s: 1 },
    "A bit pricey":          { s: -1, aspect: "pricing" },
    "Not really":            { s: -2, aspect: "value" }
  },
  q5: {
    "Happy and relaxed":     { s: 2 },
    "Satisfied":             { s: 1 },
    "Just okay":             { s: 0 },
    "Disappointed":          { s: -2 }
  },
  q6: {
    "Definitely":            { s: 2 },
    "Probably":              { s: 1 },
    "Maybe":                 { s: 0 },
    "No":                    { s: -2 }
  },
  q7: {
    "You have to try it":    { s: 2 },
    "Worth checking out":     { s: 1 },
    "It's alright":          { s: 0 },
    "I'd skip it":           { s: -2 }
  },
  q8: {
    "Hidden gem":            { s: 1, tag: "hidden gem" },
    "Solid and reliable":    { s: 1, tag: "solid and reliable" },
    "Great vibe":            { s: 1, tag: "great vibe" },
    "Needs work":            { s: -1, tag: "needs work" }
  }
};

/* ---- Sentence pools. Variety comes from random picks across
        many pools plus aspect/tag/own-word weaving. ---- */
var V3_OPENERS = {
  glow: [
    "Had such a good time at {name}.",
    "{name} honestly impressed me.",
    "What a great find — {name} really delivers.",
    "Loved my visit to {name}.",
    "This place is special. {name} got everything right.",
    "I keep thinking about my visit to {name}.",
    "Such a solid experience at {name} from start to finish."
  ],
  good: [
    "Had a really nice time at {name}.",
    "Visited {name} and came away happy.",
    "Good experience overall at {name}.",
    "Spent a lovely evening at {name}.",
    "{name} was a pleasant surprise."
  ],
  mixed: [
    "Visited {name} recently.",
    "Stopped by {name} the other day.",
    "Gave {name} a try.",
    "Was at {name} over the weekend."
  ],
  flat: [
    "Visited {name}.",
    "Tried {name} recently.",
    "Stopped by {name}."
  ]
};

var V3_OPENERS_NONAME = {
  glow: [
    "Had such a good time here.",
    "Honestly impressed with this place.",
    "What a great find — this place really delivers.",
    "Loved my visit here."
  ],
  good: [
    "Had a really nice time here.",
    "Came away happy from my visit.",
    "Good experience overall."
  ],
  mixed: [
    "Stopped by recently.",
    "Gave this place a try."
  ],
  flat: [
    "Stopped by recently.",
    "Tried this place out."
  ]
};

var V3_ASPECT_LINES = {
  quality: [
    "The quality really stood out — you can tell they care about what they put out.",
    "Top-notch quality, no corners cut.",
    "Everything felt well made and thought through.",
    "The quality here is a clear step above the usual."
  ],
  ambience: [
    "The ambience is spot on — easy to settle in and stay a while.",
    "Loved the vibe of the place, comfortable without trying too hard.",
    "Nice setting, relaxed and welcoming.",
    "The space itself makes the whole visit better."
  ],
  service: [
    "The service was warm without being over the top.",
    "Whoever served us genuinely seemed to enjoy their job.",
    "Attentive service, and they got the small details right.",
    "Felt well looked after the whole time."
  ],
  staff: [
    "The staff treated us really well — warm and genuine.",
    "Lovely people running the place, it shows.",
    "The team here knows how to look after guests.",
    "Staff were friendly and on the ball."
  ],
  value: [
    "Felt like genuinely good value for what you pay.",
    "Worth every rupee, honestly.",
    "Good value — I didn't feel overcharged for a second.",
    "You get a lot for what you spend here."
  ],
  pricing: [
    "Slightly on the pricier side, to be fair.",
    "Not the cheapest option around, but you know where the money goes."
  ]
};

var V3_CLOSERS = {
  glow: [
    "Will definitely be back soon.",
    "Already telling friends about it.",
    "Can't recommend it enough.",
    "Already planning my next visit.",
    "This one's going on my regular list.",
    "If you're in the area, don't miss it."
  ],
  good: [
    "Would happily come back.",
    "Worth a visit if you're nearby.",
    "Glad I stopped by.",
    "I'd recommend giving it a try."
  ],
  mixed: [
    "Worth trying once at least.",
    "Might be worth a visit — your mileage may vary.",
    "Decent option in the neighbourhood."
  ],
  flat: [
    "Might give it another shot someday.",
    "Has potential — hoping it gets better."
  ]
};

var V3_WEAK_LINES = {
  staff: [
    "Service could've been a touch warmer, to be honest.",
    "The staff seemed stretched — things took a while."
  ],
  service: [
    "Service was a bit patchy, to be honest.",
    "Felt like the service needs tightening up."
  ],
  value: [
    "Hard to call it value for money, honestly.",
    "Felt a bit steep for what we got."
  ],
  pricing: [
    "Felt a bit steep for what we got.",
    "Hard to call it value for money, honestly."
  ],
  quality: [
    "Quality was a bit hit or miss.",
    "Some things worked, some didn't — inconsistent."
  ],
  ambience: [
    "The place could do with a bit more atmosphere.",
    "Ambience wasn't quite there for me."
  ]
};

var V3_CHIP_FRAMES = [
  "Really liked the {list}.",
  "The {list} stood out for me.",
  "Big plus for the {list}."
];

function v3JoinList(items) {
  var items2 = items.slice(0, 3);
  return items2.length > 1
    ? items2.slice(0, -1).join(", ") + " and " + items2[items2.length - 1]
    : items2[0];
}

var V3_OWNWORD_FRAMES = [
  "What stuck with me most: {own}.",
  "{Own} — that sums up my visit pretty well.",
  "In my own words: {own}.",
  "{Own} — that says it better than I could.",
  "The thing I'll remember: {own}."
];

function v3Pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function v3CleanOwn(text) {
  var t = String(text || "").trim().replace(/\s+/g, " ");
  t = t.replace(/[.!?]+$/, "");
  return t;
}

function v3Cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ============================================================
   generateTemplateReview(businessName, questions, answers, meta)
   meta (optional): { qid: "own" } marks answers the customer
   typed themselves, so their words get woven in verbatim.
   Keeps working with legacy v2 question shapes too.
   ============================================================ */
function generateTemplateReview(businessName, questions, answers, meta) {
  meta = meta || {};
  var name = (businessName || "this place").trim() || "this place";

  var scores = [];        // sentiment-bearing question ids: q1,q3,q4,q5,q6,q7
  var aspects = [];       // praised aspect keys, in priority order
  var seenAspect = {};
  var weaknesses = [];    // aspect keys the customer was unhappy about
  var seenWeak = {};
  var ownWords = [];      // customer-typed phrases
  var chipDetails = [];   // legacy v2 multi-chip picks
  var tags = [];          // q8 descriptor tags

  function addAspect(a) {
    if (a && !seenAspect[a]) { seenAspect[a] = true; aspects.push(a); }
  }

  function addWeakness(a) {
    if (a && !seenWeak[a]) { seenWeak[a] = true; weaknesses.push(a); }
  }

  (questions || []).forEach(function (q) {
    var a = answers ? answers[q.id] : undefined;
    if (a === undefined || a === null || a === "") return;
    var isOwn = meta[q.id] === "own";

    if (isOwn && typeof a === "string" && a.trim()) {
      ownWords.push(v3CleanOwn(a));
      var qm = V3_META[q.id];
      var om = qm && qm[a.trim()];
      if (om && typeof om.s === "number" && q.id !== "q2" && q.id !== "q8") scores.push(om.s);
      if (om && om.aspect) { if (om.s > 0) addAspect(om.aspect); else if (om.s < 0) addWeakness(om.aspect); }
      if (om && om.tag) tags.push(om.tag);
      return;
    }

    var qm2 = V3_META[q.id];
    if (qm2 && typeof a === "string") {
      var m = qm2[a];
      if (m) {
        if (q.id !== "q2" && q.id !== "q8" && typeof m.s === "number") scores.push(m.s);
        if (m.aspect) { if (m.s > 0) addAspect(m.aspect); else if (m.s < 0) addWeakness(m.aspect); }
        if (m.tag) tags.push(m.tag);
        return;
      }
    }

    // Legacy v2 shapes (rating numbers, chip arrays, free strings)
    if (q.type === "rating" && typeof a === "number") {
      scores.push(a - 3);
    } else if (Array.isArray(a) && a.length) {
      chipDetails.push(v3JoinList(a.map(function (x) { return String(x).trim(); })));
    } else if (typeof a === "string" && a.trim()) {
      ownWords.push(v3CleanOwn(a));
    }
  });

  var avg = scores.length
    ? scores.reduce(function (s, v) { return s + v; }, 0) / scores.length
    : 0.8;

  var band = avg >= 1.2 ? "glow" : avg >= 0.3 ? "good" : avg >= -0.7 ? "mixed" : "flat";

  var useName = Math.random() < 0.7;
  var opener = v3Pick(useName ? V3_OPENERS[band] : V3_OPENERS_NONAME[band])
    .replace(/\{name\}/g, name);

  // Tag-flavoured opener variants (q8 "Hidden gem" etc.)
  if (tags.length && Math.random() < 0.45) {
    var tag = v3Cap(tags[0]);
    var tagOpeners = {
      glow: ["Found a real " + tags[0] + " in " + name + ".",
             (useName ? name : "This place") + " is a proper " + tags[0] + "."],
      good: ["A real " + tags[0] + " — " + (useName ? name : "this place") + " is worth knowing about."]
    };
    if (tagOpeners[band]) opener = v3Pick(tagOpeners[band]);
  }

  var middles = [];

  // Weave the customer's own words first — their voice leads.
  ownWords.slice(0, 2).forEach(function (ow) {
    if (!ow) return;
    var frame = v3Pick(V3_OWNWORD_FRAMES);
    middles.push(
      frame.replace("{own}", ow.charAt(0).toLowerCase() + ow.slice(1))
           .replace("{Own}", v3Cap(ow))
    );
  });

  // Honest note on anything the customer flagged as weak (max 1).
  weaknesses.slice(0, 1).forEach(function (wk) {
    if (V3_WEAK_LINES[wk]) middles.push(v3Pick(V3_WEAK_LINES[wk]));
  });

  // Legacy v2 chip picks ("Taste, Ambience") get a natural frame.
  chipDetails.slice(0, 1).forEach(function (cd) {
    middles.push(v3Pick(V3_CHIP_FRAMES).replace("{list}", cd));
  });

  // One or two aspect lines, shuffled order for variety.
  var aspectPool = aspects.slice();
  for (var i = aspectPool.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = aspectPool[i]; aspectPool[i] = aspectPool[j]; aspectPool[j] = tmp;
  }
  var aspectLines = V3_ASPECT_LINES;
  var nAspect = aspectPool.length > 1 && Math.random() < 0.4 ? 2 : 1;
  aspectPool.slice(0, nAspect).forEach(function (ak) {
    if (aspectLines[ak]) middles.push(v3Pick(aspectLines[ak]));
  });

  // Shuffle middles lightly so own-words don't always sit first.
  if (middles.length > 1 && Math.random() < 0.35) middles.reverse();

  var closer = v3Pick(V3_CLOSERS[band]);

  var parts = [opener].concat(middles).concat([closer]);
  var review = parts.join(" ");

  // Safety: cap length, kill accidental double spaces.
  review = review.replace(/\s+/g, " ").trim();
  return review;
}

// Allow quick testing with: node template-generator.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateTemplateReview: generateTemplateReview,
    V3_QUESTIONS: V3_QUESTIONS,
    v3DefaultQuestions: v3DefaultQuestions
  };
}
