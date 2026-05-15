// Word lists for generating random job names
const adjectives = [
  "swift", "cosmic", "neon", "cyber", "pixel", "turbo", "quantum", "stellar",
  "atomic", "hyper", "mega", "ultra", "prime", "alpha", "omega", "delta",
  "sigma", "blazing", "frozen", "golden", "silver", "crystal", "shadow",
  "phantom", "thunder", "lightning", "sonic", "lunar", "solar", "astral",
  "mystic", "ancient", "future", "rapid", "smooth", "sharp", "bright",
  "dark", "wild", "calm", "bold", "sleek", "crisp", "vivid", "fresh",
  "epic", "noble", "grand", "royal", "elite", "core", "nexus", "zen",
];

const nouns = [
  "wolf", "hawk", "dragon", "phoenix", "tiger", "panther", "falcon", "raven",
  "viper", "cobra", "storm", "blaze", "frost", "spark", "flux", "pulse",
  "wave", "beam", "glow", "rush", "dash", "bolt", "surge", "drift",
  "orbit", "comet", "nova", "star", "moon", "sun", "void", "zero",
  "byte", "node", "grid", "mesh", "link", "sync", "loop", "flow",
  "core", "hub", "port", "gate", "path", "route", "chain", "forge",
  "lab", "pod", "base", "zone", "realm", "quest", "echo", "signal",
];

const verbs = [
  "runner", "maker", "builder", "hunter", "seeker", "finder", "keeper",
  "walker", "watcher", "rider", "driver", "flyer", "jumper", "singer",
  "dancer", "caster", "breaker", "shaker", "forger", "weaver", "spinner",
  "crafter", "painter", "writer", "speaker", "thinker", "dreamer",
  "striker", "crusher", "slasher", "blazer", "chaser", "racer", "tracer",
];

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

/**
 * Generates a random 3-word job name like "cosmic-wolf-runner"
 */
export function generateRandomJobName(): string {
  const adj = randomElement(adjectives);
  const noun = randomElement(nouns);
  const verb = randomElement(verbs);
  return `${adj}-${noun}-${verb}`;
}

