// 1 & T is never or a subtype of 1 for every T but one: any absorbs the intersection, and 0
// fits in any. T isn't the checked type, so nothing distributes either.
export type IsAny<T> = 0 extends 1 & T ? true : false;
