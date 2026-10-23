type Constructor = new (...args: any[]) => {};

export function Activatable<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    active = false;

    activate(): void {
      this.active = true;
    }

    deactivate(): void {
      this.active = false;
    }
  };
}

export class User {
  constructor(readonly name: string) {}
}

export const ActivatableUser = Activatable(User);
