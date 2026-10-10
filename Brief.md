Build a polished, addictive, real-time webcam game with one simple rule:

**Keep the ball alive.**

A small, soft-looking ball or blob continuously falls through the scene under gravity. The player must move their real hand underneath it to catch and bounce it back into the air. If the ball reaches the bottom without being caught, it bursts and the round restarts.

## 1. Core Gameplay Loop

### Falling

Spawn one ball near the top of the play area. Give it a natural downward acceleration, subtle rotation, and a little organic wobble.

### Catching

Track the player's hand using webcam hand landmarks. When the hand moves underneath the falling ball, detect a valid catch based on the distance between the ball and the palm, along with the ball's downward velocity.

A successful catch launches the ball upward with a satisfying bounce.

The bounce should feel physical, with a short squash-and-stretch animation, a tiny burst of particles, and a subtle visual ripple around the hand.

### Missing

If the ball crosses the bottom boundary without a successful catch, trigger a brief impact animation. The ball bursts into particles, the score freezes, and a game-over state appears momentarily.

Then restart automatically so the player can try again immediately.

## 2. Hand Interaction

- Use real-time webcam hand tracking.
- Map the palm position smoothly into the game world.
- Detect catches using a defined collision radius around the palm.
- Require the hand to be underneath the ball, not merely nearby.
- Prevent repeated catches from triggering during the same collision.
- Add smoothing to avoid tracking jitter, but keep the response fast enough for gameplay.
- Handle lost hand tracking gracefully without accidentally awarding catches.

The ball should respond to the player's hand position, not require a pinch or an explicit grabbing gesture.

## 3. Game Feel and Visual Design

Use a single colorful blob or ball as the main character.

Give it personality through:

- Soft, elastic squash-and-stretch.
- A subtle face or expressive eyes, if they fit the visual style.
- Smooth motion trails during fast falls and bounces.
- A juicy impact burst when the player misses.
- Small particles and a quick screen shake on important events.
- A clean background with enough contrast to keep the ball easy to follow.

Keep the camera feed visible so players can see their actual hand interacting with the virtual object. Use a simple overlay or 3D scene that keeps the ball readable against varied backgrounds.

Avoid unnecessary menus, complex instructions, and decorative UI.

## 4. Scoring and Difficulty

Start with one ball and a forgiving catch radius.

- Award one point for every successful bounce.
- Gradually increase downward acceleration as the score grows.
- Introduce small variations in the ball's horizontal movement.
- Show the current score and personal best.
- Display a short, satisfying feedback animation for each milestone.

Difficulty should increase gradually, giving players enough time to understand the interaction before demanding faster reactions.

## 5. Progressive Gameplay Ideas

Implement the base game first. Design the game logic so additional mechanics can be introduced later.

**Phase 1: Core survival**

- One ball.
- Gravity and bouncing.
- Miss detection and instant restart.
- Score tracking.

**Phase 2: Movement challenges**

- Gentle wind that pushes the ball sideways.
- Heavier balls that fall faster and require more precise catches.
- Faster balls with unpredictable horizontal movement.

**Phase 3: Variety**

- Multiple balls that require juggling.
- Bonus objects that grant extra points or slow down time.
- Bombs that must be avoided rather than caught.
- Special balls with unique bounce behaviors.

Each new object should have a distinct visual identity and a clear gameplay rule.

## 6. Technical Requirements

- Use the existing web-based hand-tracking and 3D rendering architecture.
- Use a fixed-timestep or otherwise stable physics update for predictable collisions.
- Separate hand tracking, physics, collision detection, scoring, and visual effects into distinct modules.
- Use delta-time-based movement rather than frame-dependent motion.
- Tune collision tolerances for webcam tracking inaccuracies.
- Keep particle effects lightweight and optimize for real-time performance.
- Ensure that game-over and restart transitions cannot trigger duplicate scoring or overlapping rounds.

## 7. Success Criteria

The game should be playable within seconds without a tutorial.

A player should instinctively move their hand under the ball, understand the bounce, and immediately want another attempt after missing.

The catch must feel responsive, the bounce must feel satisfying, and restarting must be nearly instant.

**Design principle: One object, one rule, endless attempts.**
