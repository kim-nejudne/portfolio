/** A light switch is either 'on' or 'off'. */
export type Switch = string;

/** The other position: 'on' becomes 'off', and 'off' becomes 'on'. */
export function flip(state: Switch): Switch {
  throw new Error(`not implemented for ${state}`);
}
