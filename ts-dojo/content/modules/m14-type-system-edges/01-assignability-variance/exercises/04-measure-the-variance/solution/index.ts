// OfSub is a type built from a subtype, OfSuper the same type built from its supertype, as in
// Variance<Admin[], User[]>. Answer with how assignability between them goes.
// Each side is wrapped in a one-element tuple, so a union is compared whole, not member by member.
export type Variance<OfSub, OfSuper> = [OfSub] extends [OfSuper]
  ? [OfSuper] extends [OfSub]
    ? 'bivariant'
    : 'covariant'
  : [OfSuper] extends [OfSub]
    ? 'contravariant'
    : 'invariant';
