/** A light switch is either 'on' or 'off'. */
export type Switch = 'on' | 'off';

/** The other position: 'on' becomes 'off', and 'off' becomes 'on'. */
export function flip(state: Switch): Switch {
  return state === 'on' ? 'off' : 'on';
}
