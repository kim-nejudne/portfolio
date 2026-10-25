// EventName<H>: 'onClick' gives 'click', 'onKeyDown' gives 'keyDown', anything else gives never.
export type EventName<H> = H extends `on${infer Event}`
  ? Uncapitalize<Event>
  : never;
