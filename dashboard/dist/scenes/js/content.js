/* Soraine content: every word the page shows. Edit this file to change the story;
 * no 3D code lives here.
 *
 * STOPS  one entry per stop on the journey. The key must match a scene id in js/scenes/.
 *        `next` is where the main button goes. Keep numbers out unless they have a source.
 * INFO   the text for each clickable object's close shot. The key is the object's name.
 * NOTE   shown under every close shot until evidence records are linked.
 */
window.SORAINE_CONTENT = {
  first: 'earth',
  STOPS: {
    earth: { title: 'Flame in Freefall', line: '“Same spark. Different world.”', gravity: 'Earth · 1 g', go: 'Go to the Moon', next: 'moon' },
    moon:  { title: 'Lunar galley', line: 'The same stove, on the Moon. Things still fall here, only slowly.', gravity: 'Moon \u00B7 about 1/6 g', go: 'Go on to Mars', next: 'mars' },
    mars:  { title: 'Mars galley', line: 'The same stove, on Mars. Things fall faster here than on the Moon, and slower than on Earth.', gravity: 'Mars \u00B7 about 3/8 g', go: 'Back to the kitchen', next: 'earth' },
    orbit: { title: 'Orbit', line: 'Everything is falling together, so nothing rests on anything. The flame has no up to rise toward.', gravity: 'Orbit · free fall', go: 'Back to the kitchen', next: 'earth' }
  },
  INFO: {
    pan:      { name: 'Cast-iron pan', text: 'It sits between the flame and the food. It does not burn; it carries the heat.' },
    egg:      { name: 'Fried egg', text: 'The thing being cooked. On Earth, the hot air around it rises away.' },
    canister: { name: 'Gas canister', text: 'Holds the stove’s fuel as a liquid under pressure and feeds the burner through the hose.' },
    bottle:   { name: 'Cooking oil', text: 'A liquid that can become fuel once it is hot enough to give off vapour.' },
    stove:    { name: 'Gas stove', text: 'Fuel and air meet at the burner. A spark starts the flame.' },
    mug:      { name: 'Enamel mug', text: 'Steel with a glassy coat. It will not burn.' },
    rocket:   { name: 'Toy rocket', text: 'A reminder of where this flame is going.' }
  },
  BEGIN: 'Begin the journey',                                   // the button while the page is in the top-down view of the pan
  NOTE: 'No NASA evidence record is linked to this object yet.'
};
