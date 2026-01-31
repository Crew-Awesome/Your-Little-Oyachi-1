# Your little Oyachi — Art & Asset Checklist

## Character Sprites
- **Idle base sprite**
  - **Description:** Default grounded pose on the floor.
  - **Intended use in code:** Base idle state rendering.
  - **Notes:** Single frame or minimal idle loop. Use this as the size reference (4x pixel brush).
- **Blink variants**
  - **Description:** Subtle eye-close frames for blinking.
  - **Intended use in code:** Randomized idle blink timing.
  - **Notes:** 1–2 frames per blink.
- **Embarrassed / shy face**
  - **Description:** Soft blush and shy eyes.
  - **Intended use in code:** Expression state overlay or swap.
  - **Notes:** 1–2 frames.
- **Sleepy half-eyes**
  - **Description:** Half-lidded eyes for drowsy idle.
  - **Intended use in code:** Inactivity-based idle variant.
  - **Notes:** Single frame.
- **Idle tired (idle-tired.png)**
  - **Description:** Drowsy idle sprite before sleep.
  - **Intended use in code:** Shows after inactivity, before sleep transition.
  - **Notes:** Grounded, no movement.
- **Idle sneeze (idle-sneeze.png)**
  - **Description:** Brief sneeze reaction.
  - **Intended use in code:** Random one-shot idle reaction.
  - **Notes:** Plays once, returns to idle.
- **Sleep animation (2-frame loop)**
  - **Description:** Gentle breathing or eyelid motion.
  - **Intended use in code:** Sleep state loop.
  - **Notes:** 2-frame loop, low amplitude.
- **Sleep idle frames (sleep-idle-1.png / sleep-idle-2.png)**
  - **Description:** Two-frame sleep breathing loop.
  - **Intended use in code:** Loop during sleep state.
  - **Notes:** Keep timing slow and calming.
- **Wake-up animation**
  - **Description:** Subtle blink-open or tiny stretch.
  - **Intended use in code:** Transition from sleep to idle.
  - **Notes:** 3–6 frames, short.

## Pet Interactions
- **Squish sprite**
  - **Description:** Compressed, cute squish pose.
  - **Intended use in code:** Short click reaction.
  - **Notes:** 1–2 frames, may use squash scale.
- **Petting expression variants**
  - **Description:** Gentle and excited reactions.
  - **Intended use in code:** Click-and-hold petting loop.
  - **Notes:** 2–4 frames per variant.
- **React excited (react-excited-cute.png)**
  - **Description:** Calm, affectionate reaction to gentle pet hold.
  - **Intended use in code:** Plays during gentle hold.
  - **Notes:** Grounded; may emit hearts slowly.
- **React excited (react-excited-ayo.png)**
  - **Description:** Stronger reaction to long pet hold.
  - **Intended use in code:** Timed reaction after long hold.
  - **Notes:** Follow with a move-away hop.

## Cosmetics
- **Bow version sprites**
  - **Description:** Idle and key states with bow.
  - **Intended use in code:** Cosmetic toggle swap.
  - **Notes:** Match base sprite dimensions.
- **Dress version sprites**
  - **Description:** Idle and key states with dress.
  - **Intended use in code:** Cosmetic toggle swap.
  - **Notes:** Ensure hem stays floor-grounded.
- **Costume variants**
  - **Description:** Additional outfits beyond bow/dress.
  - **Intended use in code:** Cosmetic selection set.
  - **Notes:** Keep silhouette consistent for animations.

## Toys
- **Ball sprite**
  - **Description:** Simple, readable ball.
  - **Intended use in code:** Draggable/tossable toy object.
  - **Notes:** 1 frame with optional shadow.
- **Toy ball (ball.png)**
  - **Description:** Primary ball toy sprite.
  - **Intended use in code:** Drag, toss, and collision wake interactions.
  - **Notes:** Keep scale small and grounded to the floor.
- **Ball interaction states**
  - **Description:** Small squash or highlight during drag/impact.
  - **Intended use in code:** Feedback during toss/drag.
  - **Notes:** 2–3 frames total.

## Achievements
- **Achievement icons (or silhouettes)**
  - **Description:** Soft icons representing discoveries.
  - **Intended use in code:** Achievement list display.
  - **Notes:** Monochrome or muted palette.
- **Locked/unknown variants**
  - **Description:** Obscured or faded icons.
  - **Intended use in code:** Hidden achievements before discovery.
  - **Notes:** Use subtle blur or silhouette.

## Audio (Optional)
- **Squish sound**
  - **Description:** Soft, short squish.
  - **Intended use in code:** Play on short click.
  - **Notes:** 0.2–0.4s.
- **Petting/rubbing sound**
  - **Description:** Gentle rubbing loop.
  - **Intended use in code:** Loop during click-and-hold.
  - **Notes:** Seamless loop.
- **Purr sound**
  - **Description:** Calm purring loop.
  - **Intended use in code:** Optional overlay during petting.
  - **Notes:** Low volume, 1–3s loop.
- **Wake-up sound**
  - **Description:** Tiny chirp or soft exhale.
  - **Intended use in code:** Trigger on wake-up animation.
  - **Notes:** 0.2–0.5s.
